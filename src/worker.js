const { AhaModel, ChangesModel } = require('./models/models')
const { AllHtmlEntities }        = require('html-entities')
const { Template }               = require('adaptivecards-templating')
const { getAhaClient }           = require('./lib/aha');
const Bot                        = require('ringcentral-chatbot-core/dist/models/Bot').default;
const turnDownService            = require('turndown');
let   throng                     = require('throng');
let   Queue                      = require('bull');

const entities                   = new AllHtmlEntities();
const turnDown                   = new turnDownService();

const cardUpdateTemplate         = require('./adaptiveCards/ahaUpdateCard.json');
const cardIdeaTemplate           = require('./adaptiveCards/ahaIdeaCard.json');

let REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
let workers = process.env.WEB_CONCURRENCY || 2;

let IGNORE_FIELDS = new RegExp('(Created by user|Rank|Assigned to user|Show feature remaining estimate|Reference num)');

// The maximum number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network 
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
let maxJobsPerWorker = 50;

function start() {
    // Connect to the named work queue
    console.log("WORKER: Starting up worker. Waiting for a job.")
    let workQueue = new Queue('work', REDIS_URL);

    workQueue.process(maxJobsPerWorker, async (job) => {
	console.log(`WORKER: processing ${job.data.action} job: ${job.id}`)
	console.log("WORKER: ", job.data)

	// initialize job with bot and aha client
	const bot = await Bot.findByPk( job.data.bot_id )
	const ahaModel = await AhaModel.findOne({
	    where: {
		botId: job.data.bot_id, groupId: job.data.group_id
	    }
	})
	let token = ahaModel ? ahaModel.token : undefined
	let aha = getAhaClient(token)

	if (job.data.action == 'create') {
	    if (job.data.aha_type == 'ideas/idea') {
		console.log("WORKER: processing new idea job")
		const ideaId = job.data.audit.auditable_url.substring( job.data.audit.auditable_url.lastIndexOf('/') + 1 )

		console.log(`WORKER: aha client initialized, getting ${ideaId}`)
		aha.idea.get(ideaId, function (err, data, response) {
		    //console.log("WORKER: idea fetched from aha: ", data)
		    let idea = data.idea
		    let productId = idea.product.reference_prefix
		    console.log(`WORKER: getting workflow and categories for ${productId}`, idea)
		    let promise1 = aha.product.workflows( productId, function (err, data, response) {
			console.log("WORKER: workflow states: ", JSON.stringify(data))
			let states = []
			let promise2 = aha.product.ideaCategories( productId, function (err, data, response) {
			    //console.log("WORKER: categories fetched from aha: ", data)
			    let desc = turnDown.turndown( idea.description )
			    const cardData = {
				ahaId: job.data.audit.auditable_id,
				ahaUrl: job.data.audit.auditable_url,
				ahaType: job.data.audit.auditable_type,
				ahaIdeaId: ideaId,
				idea: idea,
				idea_description: desc,
				categories: data.idea_categories,
				workflow_states: states
			    }
			    //console.log("WORKER: Card data that will be posted: ", cardData)
			    const template = new Template(cardIdeaTemplate);
			    const card = template.expand({
				$root: cardData
			    });
			    //console.log("WORKER: posting card:", JSON.stringify(card))
			    bot.sendAdaptiveCard( job.data.group_id, card).catch( (err) => {
				console.log(`WORKER: error posting card: ${err}`)
			    });
			    console.log(`WORKER: card posted`)
			})
		    })
		})
		
	    } else {
		// TODO - error condition
		console.log(`WORKER: create job failed, unknown auditable_type = ${job.data.aha_type}`)
		job.moveToFailed({ message: "Unknown Aha object type." })
	    }
	    
	} else if (job.data.action == 'update') {
	    console.log("WORKER: processing updates to an object")
	    let progress = 0;
	    const accumulated_changes = await ChangesModel.findAll({
		'where': {
		    'ahaType' : job.data.aha_type,
		    'ahaId'   : job.data.aha_id
		}
	    })
	    if (accumulated_changes) {
		console.log(`WORKER: ${accumulated_changes.length} found to aggregate`);
		let changed_fields = {}
		let aha_object = {}
		
		// Aggregate and summarize the changes received. 
		for (let i = 0; i < accumulated_changes.length; i++)  {
		    console.log(`WORKER: Processing audit #${i}`)
		    let current_change = accumulated_changes[i]
		    let data           = current_change.data
		    let audit          = JSON.parse( data )
		    console.log("WORKER: Processing data: ", audit)
		    if (i == 0) {
			aha_object[ 'id' ]         = audit.auditable_id
			aha_object[ 'type' ]       = audit.auditable_type
			aha_object[ 'url' ]        = audit.auditable_url
			aha_object[ 'aha_id' ]     = audit.auditable_url.substring( audit.auditable_url.lastIndexOf('/') + 1 )
			aha_object[ 'created_at' ]   = audit.created_at
			aha_object[ 'contributors' ] = audit.contributors
		    }
		    for (let j = 0; j < audit.changes.length; j++) {
			console.log(`WORKER: Processing change #${j} in audit #${i}`)
			let change = audit.changes[j]
			console.log("WORKER: Change: ", change)
			
			// Figure out what changes we want to skip/ignore
			// Duplicates are ok, because we will just use the most recent value
			if (change.value == '' || // empty value
			    (IGNORE_FIELDS.test(change.field_name) && audit.audit_action === "create")
			   ) {
			    console.log(`WORKER: Skipping changes to field ${change.field_name}`)
			    continue
			} else {
			    //console.log(`WORKER: this field will NOT be skipped`)
			}
			
			// Format the value we will set the field to
			let change_value = ''
			if (audit.auditable_type === "note" || change.field_name.includes("Comment by")) {
			    //console.log(`WORKER: turning down`, change.value)
			    change_value = turnDown.turndown(change.value.toString())
			} else {
			    //console.log(`WORKER: decoding`, change.value)
			    change_value = entities.decode(change.value.toString())
			}
			
			// Add the change to the struct were we are storing all aggregated changes
			//console.log(`WORKER: setting "${change.field_name}" equal to: ${change_value}`)
			changed_fields[ change.field_name ] = {
			    title: change.field_name,
			    value: change_value
			}
			//console.log("WORKER: changed_files updated");
		    }
		    
		    // delete the change now that we have aggregated it successfully
		    console.log(`WORKER: Deleting change: ${current_change.id}`);
		    await ChangesModel.destroy({
			'where': { 'id': current_change.id }
		    })
		    
		}
		// end aggregation for loop
		
		// Send an adaptive card summarizing the changes
		console.log("WORKER: Preparing card data for", aha_object)
		const cardData = {
		    ahaId: aha_object['aha_id'],
		    ahaUrl: aha_object['url'],
		    ahaType: aha_object['type'],
		    contributors: aha_object['contributors'].map( function(e) { return e.user.name } ).join(", "),
		    changes: Object.keys(changed_fields).map( k => changed_fields[k] ),
		    change_date: aha_object['created_at']
		}
		console.log("WORKER: Card data that will be posted: ", cardData)
		const template = new Template(cardUpdateTemplate);
		const card = template.expand({
		    $root: cardData
		});
		console.log("WORKER: posting card:", card)
		await bot.sendAdaptiveCard( job.data.group_id, card);
		console.log(`WORKER: ${changes.length} aggregated for ${job.data.aha_type} with id of ${job.data.aha_id}.`)
	    } else {
		console.log(`WORKER: No changes were found to aggregate. This technically shouldn't happen.`);
	    }
	
	} else {
	    console.log(`WORKER: failing job: unknown job type ${job.data.action}`)
	    job.moveToFailed({ message: "Idea created notification posted." })
	    job.fail();
	}

	// A job can return values that will be stored in Redis as JSON
	// This return value is unused in this demo application.
	console.log("WORKER: marking job as complete")
	job.moveToCompleted("Job completed.", true)
	return { value: `Card posted for ${job.data.aha_id}` };
    });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });

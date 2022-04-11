const { AhaTokens, ChangesModel, AccountConfig }
                                  = require('./models/models')
const { AllHtmlEntities }         = require('html-entities')
const { Template }                = require('adaptivecards-templating')
const { getAhaClient }            = require('./lib/aha');
const Bot                         = require('ringcentral-chatbot-core/dist/models/Bot').default;
const turnDownService             = require('turndown');
let   throng                      = require('throng');
let   Queue                       = require('bull');

const entities                    = new AllHtmlEntities();
const turnDown                    = new turnDownService();

const cardUpdateTemplate          = require('./adaptiveCards/ahaUpdateCard.json');
const cardIdeaTemplate            = require('./adaptiveCards/newIdeaCard.json');

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

const loadIdea = ( aha, ideaId ) => {
    console.log(`WORKER: loading idea ${ideaId}`)
    const promise = new Promise( (resolve, reject) => {
        aha.idea.get(ideaId, function (err, data, response) {
	    let desc = turnDown.turndown( data.idea.description.body )
	    data.idea.description["body_nohtml"] = desc
            resolve( data )
        })
    })
    console.log("WORKER: returning from loadIdea")
    return promise
}

const loadIdeaCategories = ( aha, productId ) => {
    // TODO - loadIdeaCategories needs to iterate over a number of pages, compile a complete list
    // and then resolve the promise
    console.log(`WORKER: loading idea categories for ${productId}`)
    const promise = new Promise( (resolve, reject) => {
        aha.product.ideaCategories( productId, function (err, data, response) {
            resolve( data )
        })
    })
    console.log("WORKER: returning from loadIdeaCategories")
    return promise
}

const loadProjectWorkflows = ( aha, productId ) => {
    console.log(`WORKER: loading workflows for ${productId}`)
    const promise = new Promise( (resolve, reject) => {
        aha.product.workflows( productId, function (err, data, response) {
            console.log( "err: " , err )
            resolve( data )
        })
    })
    console.log("WORKER: returning from loadWorkflows")
    return promise
}

const postMessage = ( bot, group_id, tmpl, cardData ) => {
    console.log("WORKER: posting message with card data", cardData)
    const promise = new Promise( (resolve, reject) => {
	const template = new Template(tmpl);
	const card = template.expand({
	    $root: cardData
	});
	//console.log("WORKER: posting card:", JSON.stringify(card))
	bot.sendAdaptiveCard( group_id, card).catch( (err) => {
	    console.log(`WORKER: error posting card: ${err}`)
	});
	console.log(`WORKER: card posted`)
    })
    return promise
}

const completeJob = ( job ) => {
    console.log(`WORKER: marking job as completed: ${job.id}`)
    job.moveToCompleted("Job completed.", true)
}

function get_workflows( workflows, name ) {
    for (let i = 0; i < workflows.length; i++) {
        if (workflows[i].name == name) {
            return workflows[i].workflow_statuses
        }
    }
}

const loadChanges = ( type, id ) => {
    const promise = new Promise( (resolve, reject) => {
	ChangesModel.findAll({
	    'where': {
		'ahaType' : type,
		'ahaId'   : id
	    }
	}).then( function( accumulated_changes ) {
	    resolve( accumulated_changes )
	})
    })
    return promise
}

const aggregateChanges = ( accumulated_changes ) => {
    const promise = new Promise( (resolve, reject) => {
	let changed_fields = {}
	let aha_object = {}
	if (accumulated_changes) {
	    console.log(`WORKER: ${accumulated_changes.length} found to aggregate`);
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
		    //console.log("WORKER: Change: ", change)
		    
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
		ChangesModel.destroy({
		    'where': { 'id': current_change.id }
		})
	    }
	}
	resolve( [ aha_object, changed_fields ] )
    })
    console.log("WORKER: returning from aggregateChanges")
    return promise
}

function start() {
    // Connect to the named work queue
    console.log("WORKER: Starting up worker. Waiting for a job.")
    let workQueue = new Queue('work', REDIS_URL);

    workQueue.process(maxJobsPerWorker, async (job) => {
	console.log(`WORKER: processing ${job.data.action} job: ${job.id}`)
	console.log("WORKER: ", job.data)

	// initialize job with bot and aha client
	const bot = await Bot.findByPk( job.data.bot_id )
	const ahaTokens = await AhaTokens.findOne({
	    where: {
		botId: job.data.bot_id, groupId: job.data.group_id
	    }
	})
	let token = ahaTokens ? ahaTokens.token : undefined
	let aha = getAhaClient(token, process.env.AHA_SUBDOMAIN)
	try {
	    if (job.data.action == 'create') {
		if (job.data.aha_type == 'ideas/idea') {
		    console.log("WORKER: processing new idea job")
		    const ideaId = job.data.audit.auditable_url.substring( job.data.audit.auditable_url.lastIndexOf('/') + 1 )
		    
		    console.log(`WORKER: aha client initialized, getting ${ideaId}`)
		    const cardData = {
			botId: job.data.bot_id,
			groupId: job.data.group_id,
			ahaId: job.data.audit.auditable_id,
			ahaUrl: job.data.audit.auditable_url,
			ahaType: job.data.audit.auditable_type,
			ahaIdeaId: ideaId
		    }
		    
		    loadIdea( aha, ideaId ).then( idea => {
			idea.idea.created_at_fmt = new Date( idea.idea.created_at ).toDateString()
			console.log("WORKER: loaded idea", idea)
			cardData['idea'] = idea.idea
			cardData['selectedCategory'] = idea.idea.categories[0].id
			return loadIdeaCategories( aha, idea.idea.product.reference_prefix )
		    }).then( categories => {
			console.log("WORKER: loaded categories", categories)
			cardData['categories'] = categories.idea_categories
			return loadProjectWorkflows( aha, cardData["idea"].product.reference_prefix )
		    }).then( workflows => {
			console.log("WORKER: loaded workflows", workflows)
			cardData['workflows'] = get_workflows(workflows.workflows, "Product idea workflow" )
			console.log("WORKER: finished loading all idea metadata")
			return postMessage( bot, job.data.group_id, cardIdeaTemplate, cardData )
		    }).then( function() {
			completeJob(job)
		    })
		    
		} else {
		    // TODO - error condition
		    console.log(`WORKER: create job failed, unknown auditable_type = ${job.data.aha_type}`)
		    job.moveToFailed({ message: "Unknown Aha object type." })
		}
		
	    } else if (job.data.action == 'update') {

		console.log("WORKER: processing updates to an object")
		loadChanges( job.data.aha_type, job.data.aha_id ).then( accumulated_changes => {
		    return aggregateChanges( accumulated_changes )
		}).then( result => {
		    let aha_obj = result[0]
		    let changes = result[1]
		    const cardData = {
			botId:        job.data.bot_id,
			groupId:      job.data.group_id,
			ahaId:        aha_obj['aha_id'],
			ahaUrl:       aha_obj['url'],
			ahaType:      aha_obj['type'],
			contributors: aha_obj['contributors'].map( function(e) { return e.user.name } ).join(", "),
			changes:      Object.keys(changes).map( k => changes[k] ),
			change_date:  aha_obj['created_at']
		    }
		    console.log("WORKER: Card data that will be posted: ", cardData)
		    console.log(`WORKER: ${changes.length} aggregated for job ${job.id}.`)
		    return postMessage( bot, job.data.group_id, cardUpdateTemplate, cardData )
		}).then( function() {
		    completeJob(job)
		}) 
	    }
	} catch (error) {
	    console.log("ERROR-----------------", error)
	}
	    
	return Promise.resolve()
	//return { value: `Worker finished` };
    });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });

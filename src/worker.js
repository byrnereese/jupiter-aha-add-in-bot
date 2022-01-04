const { AhaModel } = require('./models/ahaModel');
const { AhaChangesModel } = require('./models/changesModel');

let throng = require('throng');
let Queue = require("bull");

let REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
let workers = process.env.WEB_CONCURRENCY || 2;

// The maximum number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network 
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
let maxJobsPerWorker = 50;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function start() {
    // Connect to the named work queue
    let workQueue = new Queue('work', REDIS_URL);

    workQueue.process(maxJobsPerWorker, async (job) => {
	console.log(`WORKER: job.group_id = ${job.group_id}`)
	console.log(`WORKER: job.bot_id = ${job.bot_id}`)
	console.log(`WORKER: job.aha_type = ${job.aha_type}`)
	console.log(`WORKER: job.aha_id = ${job.aha_id}`)
	let progress = 0;
	// Wake up and retrieve all related changes
	const changes = await AhaChangesModel.findAll({
	    'where': {
		'ahaType' : job.aha_type,
		'ahaId'   : job.aha_id
	    }
	})
	if (changes) {
	    // Changes were found. Make a note, then delete the change.
	    // Remember, at this point we are not yet doing anything.
	    // TODO - do something
	    for (let i = 0; i < changes.length; i++)  {
		let change = changes[i];
		console.log(`WORKER: Deleting change: ${change.id}`);
		await.AhaChangesModel.destroy({
		    'where': { 'id': change.id }
		})
	    }
	}
      }
		      
      // A job can return values that will be stored in Redis as JSON
      // This return value is unused in this demo application.
      return { value: "This will be stored" };
    });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });

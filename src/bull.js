const express = require('express')
const Queue = require('bull')
const QueueMQ = require('bullmq')
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter')
const { ExpressAdapter } = require('@bull-board/express')

let REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const workQueue = new Queue('work', REDIS_URL);

const serverAdapter = new ExpressAdapter();

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullAdapter(workQueue)
  ],
  serverAdapter:serverAdapter
})

const app = express()

serverAdapter.setBasePath('/admin/queues')
app.use('/admin/queues', serverAdapter.getRouter());

// other configurations of your server
# Jupiter Aha Add-In Bot

## Add Adaptive Card

Adaptive card can be designed with [Adaptive Cards Designer](https://adaptivecards.io/designer/) where the json data in `CARD PAYLOAD EDITOR` can be save as `xxx.json` and stored under `src/adaptive-cards` folder. Please refer to existing use of `ahaCard.json` as example.

## Deploy to Heroku

Fork this repo and click below button for your first time deployment. (Note: Heroku Button is to be used for the first time setup. Further changes are to be made on Heroku app web page)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Right after the deployment, make sure taking following steps to configure it:
1. Go to your app settings page on Heroku
3. Go to `Domains` section and copy your server url (do not include the last '/'). Let's call it `BotServerUrl`
2. Reveal Config Vars
3. Find `RINGCENTRAL_CHATBOT_SERVER` and edit it to be `BotServerUrl`
4. Find `DATABASE_URL` and copy its value. Put it onto `RINGCENTRAL_CHATBOT_DATABASE_CONNECTION_URI`

### Automate Deployment

1. Go to app's `Deploy` tab
2. In `Deployment method` section, connect it with your Github repo.
3. Enable `Automatic deploys`. It will then deploy upon every git push to your git remote repo.

## Configure on RingCentral Developer Portal

1. Create a `Bot Add-In` app
2. Go to your app's `Settings` tab on RingCentral Developer Portal
3. Find `OAuth Redirect URI` and fill it with `{BotSererUrl}/bot/oauth`
4. Go to `Bot` tab and click `Add to RingCentral` (Note: bot server url might not be updated right away. Please wait for a few minutes if it fails.)

Note: Aha server seems like using an internal polling mechanism which doesn't send the activity message right after the change. It feels like there's a 5min interval.

## Try on RingCentral Jupiter

Note: if bot's status is `In Sandbox`, then go to `https://app.devtest.ringcentral.com/`. Please also update `RINGCENTRAL_SERVER` in Heroku app env var config if switching between Sandbox and Production

Add the bot to a group chat and type `@{botName} help` or direct message the bot `help`.
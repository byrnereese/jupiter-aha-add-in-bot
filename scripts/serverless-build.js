const { rm, echo, cp } = require('shelljs');
const { resolve } = require('path');

const projectPath = resolve(__dirname, '..');
const deployPath = resolve(projectPath, 'serverless-deploy')

echo('clean path...');
rm('-rf', `${deployPath}/*.js`);
rm('-rf', `${deployPath}/*.json`);
rm('-rf', `${deployPath}/server`);
rm('-rf', `${deployPath}/adaptiveCards`);
rm('-rf', `${deployPath}/handlers`);
rm('-rf', `${deployPath}/lib`);
rm('-rf', `${deployPath}/models`);
echo('building...');
cp('-r', `${projectPath}/src/handlers`, `${deployPath}/handlers`);
cp('-r', `${projectPath}/src/adaptiveCards`, `${deployPath}/adaptiveCards`);
cp('-r', `${projectPath}/src/lib`, `${deployPath}/lib`);
cp('-r', `${projectPath}/src/models`, `${deployPath}/models`);
cp(`${projectPath}/src/index.js`, `${deployPath}/index.js`);
cp(`${projectPath}/src/lambda.js`, `${deployPath}/lambda.js`);
cp(`${projectPath}/src/bull.js`, `${deployPath}/bull.js`);
cp(`${projectPath}/src/worker.js`, `${deployPath}/worker.js`);
cp(`${projectPath}/package.json`, `${deployPath}/package.json`);
cp(`${projectPath}/package-lock.json`, `${deployPath}/package-lock.json`);

echo('build done');

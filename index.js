/**
 * Created by axetroy on 17-4-20.
 */
require('colors');
const Promise = require('bluebird');
const path = require('path');
const _ = require('lodash');
global.Promise = Promise;
const fs = Promise.promisifyAll(require('fs-extra'));
const co = require('co');
const axios = require('axios');
const Flow = require('@axetroy/flow');
const prettifyTime = require('prettify-time');

function getMeta() {
  return axios.get(`https://greasyfork.org/zh-CN/scripts`).then(res => {
    let html = res.data;
    const match = html.match(/\?page=(\d+)/gim) || [];
    const pages = match.map(v => +v.replace(/\?page=/g, ''));
    const lastPage = Math.max(...pages);
    return Promise.resolve(lastPage);
  });
}

function getList(page = 1) {
  const url = `https://greasyfork.org/zh-CN/scripts?page=${page}`;
  return axios
    .get(url, {
      headers: {
        accept: 'application/json'
      }
    })
    .then(res => {
      console.log(`[GET] ${url.green}`);
      return Promise.resolve(res);
    })
    .catch(err => {
      console.log(`[GET] ${url.red}`);
      return Promise.resolve(err);
    });
}

function getMaxScriptsOwner(scripts) {
  const groupByUsername = _.groupBy(scripts, v => v.user.name);
  const maxScripts = {
    username: '',
    number: 0
  };
  for (let username in groupByUsername) {
    const scripts = groupByUsername[username];
    if (scripts.length > maxScripts.number) {
      maxScripts.number = scripts.length;
      maxScripts.username = username;
    }
  }
  return maxScripts;
}

function* main() {
  const startTime = new Date();
  const lastPage = yield getMeta();
  let result = new Array(lastPage);

  const flow = new Flow(20);

  for (let page = 0; page < lastPage; page++) {
    flow.append(function(next) {
      getList(page + 1)
        .then(function(res) {
          result[page] = res.data;
        })
        .finally(() => next());
    });
  }

  yield flow.run();

  const scripts = [].concat(_.flatten(result)).map(v => v);

  const maxScripts = getMaxScriptsOwner(scripts);
  const maxGoodRatingScript = _.maxBy(scripts, s => s.good_ratings);
  const maxBadRatingScript = _.maxBy(scripts, s => s.bad_ratings);
  const maxTotalInstallScript = _.maxBy(scripts, s => s.total_installs);
  const maxDailyInstallScript = _.maxBy(scripts, s => s.daily_installs);

  yield fs.ensureDirAsync('dist');
  yield fs.writeJsonAsync(path.join('dist', 'data.json'), scripts);

  const endTime = new Date();

  console.log(
    `
  总共有${(scripts.length + '').underline}个脚本
  
  ${maxScripts.username.green} 有最多的脚本 ${(maxScripts.number + '').underline} 个
  
  最受欢迎的脚本: ${maxGoodRatingScript.name.green} 好评${(maxGoodRatingScript.good_ratings + '').underline}个
  
  最臭名昭著的脚本: ${maxBadRatingScript.name.green} 踩${(maxBadRatingScript.good_ratings + '').underline}次
  
  总安装量最高: ${maxTotalInstallScript.name.green} 共${(maxBadRatingScript.total_installs + '').underline}次
  
  日安装量最高: ${maxDailyInstallScript.name.green} 共${(maxDailyInstallScript.daily_installs + '').underline}次
  
  Done in ${prettifyTime.secondsToDuration((endTime - startTime) / 1000, [
      'h',
      'm',
      's'
    ]).totalTime}
  `
  );
}
co(main).catch(function(err) {
  console.error(err);
});

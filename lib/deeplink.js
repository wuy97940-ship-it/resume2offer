/* resume2offer - deeplink.js
 * 跳转链接生成：官网投递（落脚点）+ BOSS直聘/猎聘交叉搜索深链（只做跳转，不抓取数据）
 */
(function () {
  'use strict';

  const R2O = (window.R2O = window.R2O || {});

  // 常用城市 BOSS直聘 city code（可按需补充，来源：浏览器自动化取自地址栏）
  const BOSS_CITY = {
    '杭州': '101210100',
    '全国': '100010000'
  };

  function enc(s) {
    return encodeURIComponent(String(s || ''));
  }

  R2O.deeplink = {
    /** 公司官网招聘入口；未收录官网时回退到搜索「公司名 官网 招聘」 */
    careers(company) {
      if (company.careers_url) return company.careers_url;
      return 'https://www.bing.com/search?q=' + enc(company.name + ' 官网 招聘');
    },

    /** BOSS直聘：按公司名搜其职位 */
    boss(company, cityCode) {
      const city = cityCode || BOSS_CITY['杭州'];
      return 'https://www.zhipin.com/web/geek/job?query=' + enc(company.name) + '&city=' + city;
    },

    /** 猎聘：按公司名搜索 */
    liepin(jobKey) {
      return 'https://www.liepin.com/zhaopin/?key=' + enc(jobKey);
    },

    /** BOSS直聘：按岗位关键词+城市搜索 */
    bossKeyword(keyword, cityName) {
      const city = BOSS_CITY[cityName || '杭州'] || BOSS_CITY['杭州'];
      return 'https://www.zhipin.com/web/geek/job?query=' + enc(keyword) + '&city=' + city;
    },

    /** 猎聘：按岗位关键词搜索 */
    liepinKeyword(keyword) {
      return 'https://www.liepin.com/zhaopin/?key=' + enc(keyword);
    }
  };
})();

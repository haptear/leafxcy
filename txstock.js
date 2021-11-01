/*
腾讯自选股 APP&微信小程序
改自@CenBoMin大佬的脚本
只适配了IOS，测试了青龙和V2P，其他平台请自行测试
安卓请自行测试，据说安卓可以捉APP的包，微信小程序需要在电脑端捉
多账户用#隔开

内置了多账户相互做分享任务，账户数多于一个才能用
测试了做分享任务的情况下，一天收益大概在14000金币
默认自动提现5元和做分享任务
不想提现的话自己新建一个TxStockCash环境变量，0代表不提现，1代表提现1元，5代表提现5元
不想做分享任务的话，新建一个TxStockHelp环境变量，0代表不做分享互助


青龙：
APP和微信都捉 https://wzq.tenpay.com/cgi-bin/activity_task_daily.fcgi? 开头的包，点击获取金币，看到任务应该就能捉到
APP捉包把整个URL放进去TxStockAppUrl，header转成JSON字符串之后放进去TxStockAppHeader
微信小程序捉包后header转成JSON字符串之后放进去TxStockWxHeader
export TxStockAppUrl='https://wzq.ten....#https://wzq.ten....#https://wzq.ten....'
export TxStockAppHeader='{"Host":"...","Accept":"...",...}#{"Host":"...","Accept":"...",...}#{"Host":"...","Accept":"...",...}'
export TxStockWxHeader='{"Host":"...","Accept":"...",...}#{"Host":"...","Accept":"...",...}#{"Host":"...","Accept":"...",...}'

重写食用
TxStockAppUrl与TxStockAppHeader：打开APP，点击头像->右上角金币->获取金币
TxStockWxHeader：打开小程序，我的->猜涨跌->下方兑换->获取金币

V2P：
重写: https://wzq.tenpay.com/cgi-bin/activity_task_daily.fcgi?   txstockqx_leaf.js
MITM: wzq.tenpay.com

圈X：
[task_local]
#腾讯自选股
30 7 * * * txstock.js, tag=腾讯自选股, enabled=true
[rewrite_local]
#获取APP和微信小程序的URL和header
https://wzq.tenpay.com/cgi-bin/activity_task_daily.fcgi? url script-request-header txstock.js
[MITM]
hostname = wzq.tenpay.com

*/

const jsname = '腾讯自选股'
const $ = Env(jsname)
const logs = 0; //0为关闭日志，1为开启,默认为0
const notifyInterval = 1; //0为关闭通知，1为所有通知,默认为0

let rndtime = "" //毫秒
let signday = formatDateTime(new Date());
var cash = ($.isNode() ? (process.env.TxStockCash) : ($.getval('TxStockCash'))) || 5; //0为不自动提现,1为自动提现1元,5为自动提现5元
var help = ($.isNode() ? (process.env.TxStockHelp) : ($.getval('TxStockHelp'))) || 1; //0为不做分享助力任务，1为多账户互相分享助力

const appUrlArr = [];
let appUrlArrVal = "";

const appHeaderArr = [];
let appHeaderArrVal = "";

const wxHeaderArr = [];
let wxHeaderArrVal = "";

let rewardCoin = 0
let coinStart = []
let coinEnd = []
let coinInfo = ""

let i = 0
let j = 0
let k = 0
let numUser = 0
let helpUser = 0
let NOT_PRINT = 0
let PRINT = 1
let scanList = []
let nickname = []
let ticket = ""
let wxticket = ""

let bullInviteCode = ""
let bullInviteCodeArr = []

let bullHelpCode = ""
let bullHelpCodeArr = []

let userAppShareTaskList = ["task_50_1110", "task_51_1110", "task_50_1111", "task_51_1111", "task_51_1112", "task_51_1113"]
let userAppShareCodeArr = {}
//let userWxShareTaskList = ["task_50_1110", "task_51_1110", "task_50_1111", "task_51_1111", "task_51_1112", "task_51_1113"]
let userWxShareTaskList = []
let userWxShareCodeArr = {}

//APP任务
let appDailyArray = [1100, 1101, 1103, 1104, 1105, 1109, 1110, 1111, 1112, 1113];
let appNewbieArray = [1030];
let appBullArray = [1105];
let appTaskArray = [];

//微信小程序任务
let wxDailyArray = [1100, 1101, 1103, 1104, 1105, 1109, 1110, 1111, 1112, 1113];
let wxNewbieArray = [1031];
let wxBullArray = [1106];
let wxTaskArray = [];

//APP长牛任务
let bullTaskArray = { 
    "rock_bullish":{"taskName":"戳牛任务", "action":"rock_bullish", "actid":1105}, 
    "open_box":{"taskName":"开宝箱", "action":"open_box", "actid":1105}, 
    "open_blindbox":{"taskName":"开盲盒", "action":"open_blindbox", "actid":1105}, 
    "query_blindbox":{"taskName":"查询皮肤数量", "action":"query_blindbox", "actid":1105},
    "sell_skin":{"taskName":"卖皮肤", "action":"sell_skin", "actid":1105},
    "feed":{"taskName":"喂长牛", "action":"feed", "actid":1105},
}

var TxStockAppUrl
var TxStockAppHeader
var TxStockWxHeader

///////////////////////////////////////////////////////////////////

!(async () => {

    if(typeof $request !== "undefined")
    {
        if($request.url.indexOf("activity_task_daily.fcgi?") > -1) {
            if($request.url.indexOf("openid=") > -1)
            {
                //APP包
                $.setdata($request.url,'TxStockAppUrl')
                $.log(`获取TxStockAppUrl成功: ${$request.url}\n`)
                $.setdata(JSON.stringify($request.headers),'TxStockAppHeader')
                $.log(`获取TxStockAppHeader成功: ${JSON.stringify($request.headers)}\n`)
            }
            else
            {
                //微信包
                $.setdata(JSON.stringify($request.headers),'TxStockWxHeader')
                $.log(`获取TxStockWxHeader成功: ${JSON.stringify($request.headers)}\n`)
            }
        }
    }
    else
    {
        if($.isNode())
        {
            TxStockAppUrl = process.env.TxStockAppUrl
            TxStockAppHeader = process.env.TxStockAppHeader
            TxStockWxHeader = process.env.TxStockWxHeader
        }
        else
        {
            TxStockAppUrl = $.getdata('TxStockAppUrl')
            TxStockAppHeader = $.getdata('TxStockAppHeader')
            TxStockWxHeader = $.getdata('TxStockWxHeader')
        }
        
        
        
        if(TxStockAppUrl && TxStockAppHeader)
        {
            if (TxStockAppUrl.indexOf('#') > -1) {
                appUrlArrs = TxStockAppUrl.split('#');
                console.log(`您选择的是用"#"隔开TxStockAppUrl\n`)
            } else {
                appUrlArrs = [TxStockAppUrl]
            };
            Object.keys(appUrlArrs).forEach((item) => {
                if (appUrlArrs[item]) {
                    appUrlArr.push(appUrlArrs[item])
                }
            })
            
            if (TxStockAppHeader.indexOf('#') > -1) {
                appHeaderArrs = TxStockAppHeader.split('#');
                console.log(`您选择的是用"#"隔开TxStockAppHeader\n`)
            } else {
                appHeaderArrs = [TxStockAppHeader]
            };
            Object.keys(appHeaderArrs).forEach((item) => {
                if (appHeaderArrs[item]) {
                    appHeaderArr.push(appHeaderArrs[item])
                }
            })
        }
        else
        {
            $.log("未找到环境变量 TxStockAppUrl或TxStockAppHeader。无法做APP任务，签到和提现\n")
        }
        
        if(TxStockWxHeader)
        {
            if (TxStockWxHeader.indexOf('#') > -1) {
                wxHeaderArrs = TxStockWxHeader.split('#');
                console.log(`您选择的是用"#"隔开TxStockWxHeader\n`)
            } else {
                wxHeaderArrs = [TxStockWxHeader]
            };
            Object.keys(wxHeaderArrs).forEach((item) => {
                if (wxHeaderArrs[item]) {
                    wxHeaderArr.push(wxHeaderArrs[item])
                }
            })
        }
        else
        {
            $.log("未找到环境变量 TxStockWxHeader，无法做微信小程序任务\n")
        }
        
        await initTaskList()
        
        let totalUser = appUrlArr.length
        let shareFlag = 0
        
        if(help && TxStockAppUrl && TxStockAppHeader && TxStockWxHeader && totalUser > 1)
        {
            shareFlag = 1
        }
        
        for (numUser = 0; numUser < totalUser; numUser++)
        {
            await getEnvParam(numUser)
            
            $.log(`\n======= 开始腾讯自选股账号 ${numUser+1} =======\n`)
            
            coinInfo = ""
            
            //扫描可查询的任务列表,
            //await scanAppTaskList(1000,1400,"task_daily","routine",NOT_PRINT)
            //await scanWxTaskList(1000,1400,"task_daily","routine",NOT_PRINT) //每个大概花费86ms
            
            if(TxStockAppUrl && TxStockAppHeader)
            {
                await userhome(); //金币查询
                coinStart.push(coinInfo)
                await orderQuery(1)
                await signStatus()

                for(j=0; j<appTaskArray.length; j++)
                {
                    await appTaskList(appTaskArray[j]);
                }
            }

            if(TxStockWxHeader)
            {
                for(j=0; j<wxTaskArray.length; j++)
                {
                    await wxTaskList(wxTaskArray[j]);
                }
            }
            
            await bullTask(bullTaskArray["rock_bullish"])
            for(i=0; i<10; i++){
                await bullTask(bullTaskArray["open_box"])
                await $.wait(5000)
            }
            await bullTask(bullTaskArray["open_blindbox"])
            await bullTask(bullTaskArray["query_blindbox"])
            
            await bullStatus()
            
            if(shareFlag)
            {
                for (j=0; j<userAppShareTaskList.length; j++)
                {
                    await appShareTaskReq(userAppShareTaskList[j])
                }
                for (j=0; j<userWxShareTaskList.length; j++)
                {
                    await wxShareTaskReq(userWxShareTaskList[j])
                }
            }
            
            $.log(`\n======= 结束腾讯自选股账号 ${numUser+1} 任务 =======\n`)
        }
        
        //互助
        if(shareFlag)
        {
            $.log(`\n开始做互助任务：\n`)
            for (numUser = 0; numUser < totalUser; numUser++)
            {
                await getEnvParam(numUser)
                
                $.log(`\n======= 账户${nickname[numUser]} 开始帮助其他账户=======\n`)
                for (helpUser = 0; helpUser < totalUser; helpUser++){
                    if(helpUser != numUser) {
                        await bullInvite(bullInviteCodeArr[helpUser],bullHelpCodeArr[helpUser])
                        
                        for (j=0; j<userAppShareTaskList.length; j++)
                        {
                            shareTaskName = userAppShareTaskList[j]
                            if(userAppShareCodeArr[shareTaskName]) {
                                await wxShareTaskDone(shareTaskName,userAppShareCodeArr[shareTaskName][helpUser])
                            }
                        }
                        
                        for (j=0; j<userWxShareTaskList.length; j++)
                        {
                            shareTaskName = userWxShareTaskList[j]
                            if(userWxShareCodeArr[shareTaskName]) {
                                await wxShareTaskDone(shareTaskName,userWxShareCodeArr[shareTaskName][helpUser])
                            }
                        }
                    }
                }
                $.log(`\n======= 账户${nickname[numUser]} 结束助力=======\n`)
            }
            $.log(`\n结束互助任务\n`)
            await $.wait(5000)
        }
        
        //收益查询，提现
        if(TxStockAppUrl && TxStockAppHeader)
        {
            for (numUser = 0; numUser < totalUser; numUser++)
            {
                await getEnvParam(numUser)
                
                await userhome(); //第二次金币查询
                coinEnd.push(coinInfo)
                
                if(coinEnd[numUser] && coinStart[numUser])
                {
                    rewardCoin = coinEnd[numUser] - coinStart[numUser];
                    $.log(`\n账号：${nickname[numUser]}，本次运行获得${rewardCoin}金币\n`)
                }
                
                await orderQuery(0)
            }
        }
    }
  

})()
.catch((e) => $.logErr(e))
  .finally(() => $.done())
  
function getEnvParam(userNum)
{
    if(TxStockAppUrl && TxStockAppHeader)
    {
        appUrlArrVal = appUrlArr[userNum];
        appHeaderArrVal = JSON.parse(appHeaderArr[userNum]);
        
        app_openid = appUrlArrVal.match(/&openid=([\w-]+)/)[1]
        app_fskey = appUrlArrVal.match(/&fskey=([\w-]+)/)[1]
        app_token = appUrlArrVal.match(/&access_token=([\w-]+)/)[1]
        app_appName = appUrlArrVal.match(/&_appName=([\w\.,-]+)/)[1]
        app_appver = appUrlArrVal.match(/&_appver=([\w\.,-]+)/)[1]
        app_osVer = appUrlArrVal.match(/&_osVer=([\w\.,-]+)/)[1]
        app_devId = appUrlArrVal.match(/&_devId=([\w-]+)/)[1]
        
        app_ck = appHeaderArrVal["Cookie"]
        app_UA = appHeaderArrVal["User-Agent"]
    }
    
    if(TxStockWxHeader)
    {
        wxHeaderArrVal = JSON.parse(wxHeaderArr[userNum]);
        
        wx_ck = wxHeaderArrVal["Cookie"]
        wx_UA = wxHeaderArrVal["User-Agent"]
    }
}

function initTaskList() {
    $.log(`开始初始化任务列表\n`)
    let taskItem = {}
    
    //默认不做新手任务
    /*
    for(i=0; i<appNewbieArray.length; i++){
        taskItem = {"taskName":"APP新手任务","activity":"task_continue","type":"app_new_user","actid":appNewbieArray[i]}
        appTaskArray.push(taskItem)
    }
    */
    
    //todo: 长牛任务
    /*
    for(i=0; i<appBullArray.length; i++){
        taskItem = {"taskName":"APP长牛任务","activity":"year_party","type":"bullish","actid":appBullArray[i]}
        appTaskArray.push(taskItem)
    }
    */
    
    for(i=0; i<appDailyArray.length; i++){
        taskItem = {"taskName":"APP日常任务","activity":"task_daily","type":"routine","actid":appDailyArray[i]}
        appTaskArray.push(taskItem)
    }
    
    //默认不做新手任务
    /*
    for(i=0; i<wxNewbieArray.length; i++){
        taskItem = {"taskName":"微信新手任务","activity":"task_continue","type":"wzq_welfare_growth","actid":wxNewbieArray[i]}
        wxTaskArray.push(taskItem)
    }
    */
    
    //todo: 长牛任务
    /*
    for(i=0; i<wxBullArray.length; i++){
        taskItem = {"taskName":"微信长牛任务","activity":"year_party","type":"bullish","actid":wxBullArray[i]}
        wxTaskArray.push(taskItem)
    }
    */
    
    for(i=0; i<wxDailyArray.length; i++){
        taskItem = {"taskName":"微信日常任务","activity":"task_daily","type":"routine","actid":wxDailyArray[i]}
        wxTaskArray.push(taskItem)
    }
}

//扫描可查询的APP任务列表
async function scanAppTaskList(actidStart,actidEnd,activity,type,debugPrint) {
    console.log(`开始查询APP任务列表, activity=${activity}, type=${type}, from ${actidStart} to ${actidEnd}`)
    for(i=actidStart; i<actidEnd; i++){
        titem = {"taskName":`扫描任务${i}`,"activity":activity,"type":type,"actid":i}
        await appTaskListQuery(titem,debugPrint);
        await $.wait(100)
    }
    console.log(`查询结束，得到列表：`)
    console.log(scanList)
}

//扫描可查询的微信任务列表
async function scanWxTaskList(actidStart,actidEnd,activity,type,debugPrint) {
    console.log(`开始查询微信任务列表, activity=${activity}, type=${type}, from ${actidStart} to ${actidEnd}`)
    for(i=actidStart; i<actidEnd; i++){
        titem = {"taskName":`扫描任务${i}`,"activity":activity,"type":type,"actid":i}
        await wxTaskListQuery(titem,debugPrint);
        await $.wait(20)
    }
    console.log(`查询结束，得到列表：`)
    console.log(scanList)
}

///////////////////////////////////////////////////////////////////
//签到信息查询
async function signStatus() {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let signurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_sign_task.fcgi?actid=2002&channel=1&type=welfare_sign&action=home&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(signurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        //console.log(data);
                        if (data.retcode == 0) {
                            $.log(`已连续签到${data.task_pkg.continue_sign_days}天，总签到天数${data.task_pkg.total_sign_days}天\n`);
                            for(i=0; i<data.task_pkg.tasks.length; i++){
                                resultItem = data.task_pkg.tasks[i]
                                if(resultItem.date == signday){
                                    if(resultItem.status == 0){
                                        //今天未签到，去签到
                                        await $.wait(200);
                                        await signtask();
                                    } else {
                                        //今天已签到
                                        $.log(`签到:今天已签到\n`);
                                    }
                                }
                            }
                        } else {
                            console.log(`任务完成失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//签到
async function signtask() {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let signurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_sign_task.fcgi?actid=2002&channel=1&action=signdone&date=${signday}&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(signurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        if (data.retcode == 0) {
                            $.log(`签到:获得 ${data.reward_desc}\n`);
                            $.log(`签到时间:${time(rndtime)}\n`);
                            await $.wait(5000); //等待5秒
                        } else {
                            console.log(`任务完成失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//APP任务列表
async function appTaskList(taskItem) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_${taskItem.activity}.fcgi?action=home&type=${taskItem.type}&actid=${taskItem.actid}&invite_code=&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        //console.log(data)
                        if (data.retcode == 0) {
                            if(data.task_pkg != null && data.task_pkg.length > 0){
                                for(i=0; i<data.task_pkg[0].tasks.length; i++){
                                    resultItem = data.task_pkg[0].tasks[i]
                                    //console.log(resultItem)
                                    task_id = resultItem.id
                                    task_tid = resultItem.tid
                                    if(resultItem.status == 0) {
                                        await appTaskticket(taskItem); //申请票据
                                        await appTaskDone(taskItem,ticket,task_id,task_tid);
                                    } else {
                                        $.log(`${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]已完成\n`);
                                        await $.wait(100);
                                    }
                                }
                            }
                        } else {
                            console.log(`${taskItem.taskName}查询失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//APP票据申请
function appTaskticket(taskItem) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let testurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_task.fcgi?action=taskticket&channel=1&actid=${taskItem.actid}&_rndtime=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `http://zixuanguapp.finance.qq.com`,
                'Accept-Encoding': `gzip,deflate`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-Hans-CN;q=1, en-CN;q=0.9`
            },
        }
        $.get(testurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let test2 = JSON.parse(data)
                        ticket = test2.task_ticket
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//APP任务列表查询
async function appTaskListQuery(taskItem,printDebug=0) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_${taskItem.activity}.fcgi?action=home&type=${taskItem.type}&actid=${taskItem.actid}&channel=1&invite_code=&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        if (data.retcode == 0) {
                            if(data.task_pkg != null && data.task_pkg.length > 0){
                                scanList.push(taskItem.actid)
                                if(printDebug) {
                                    //console.log(data)
                                    console.log(`===================== actid=${taskItem.actid} start ======================`)
                                    for(i=0; i<data.task_pkg[0].tasks.length; i++){
                                        resultItem = data.task_pkg[0].tasks[i]
                                        console.log(resultItem)
                                    }
                                    console.log(`===================== actid=${taskItem.actid} end ======================`)
                                }
                            }
                        } else {
                            //console.log(`${taskItem.taskName}查询失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//APP任务状态
function appTaskStatus(actid,task_id,task_tid) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let testurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_task.fcgi?id=${task_id}&tid=${task_tid}&actid=${actid}&channel=1&action=taskstatus&_rndtime=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `http://zixuanguapp.finance.qq.com`,
                'Accept-Encoding': `gzip,deflate`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-Hans-CN;q=1, en-CN;q=0.9`
            },
        }
        $.get(testurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let task = JSON.parse(data)
                        console.log(task)
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//做APP任务
function appTaskDone(taskItem,ticket,task_id,task_tid) {
    return new Promise((resolve, reject) => {
        let testurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_task.fcgi?action=taskdone&channel=1&actid=${taskItem.actid}&id=${task_id}&tid=${task_tid}&task_ticket=${ticket}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `http://zixuanguapp.finance.qq.com`,
                'Accept-Encoding': `gzip,deflate`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-Hans-CN;q=1, en-CN;q=0.9`
            },
        }
        $.get(testurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let task = JSON.parse(data)
                        //console.log(task)
                        if(task.retcode == 0){
                            $.log(`完成${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]:获得 ${task.reward_desc}\n`);
                            await $.wait(10000); //等待10秒
                        } else {
                            $.log(`${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]未完成：${task.retmsg}\n`);
                            await $.wait(100);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//WX任务列表
async function wxTaskList(taskItem) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_${taskItem.activity}.fcgi?action=home&type=${taskItem.type}&actid=${taskItem.actid}&invite_code=&_=${rndtime}`,
            headers: {
                'Cookie': wx_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': wx_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        //console.log(data)
                        if (data.retcode == 0) {
                            if(data.task_pkg != null && data.task_pkg.length > 0){
                                for(i=0; i<data.task_pkg[0].tasks.length; i++){
                                    resultItem = data.task_pkg[0].tasks[i]
                                    //console.log(resultItem)
                                    task_id = resultItem.id
                                    task_tid = resultItem.tid
                                    if(resultItem.status == 0){
                                        await wxtaskticket(taskItem); //申请票据
                                        await wxTaskDone(taskItem,wxticket,task_id,task_tid);
                                    } else {
                                        $.log(`${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]已完成\n`);
                                        await $.wait(100);
                                    }
                                }
                            }
                        } else {
                            console.log(`${taskItem.taskName}查询失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//WX票据申请
function wxtaskticket(taskItem) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_task.fcgi?t=${rndtime}`,
            body: `_h5ver=2.0.1&actid=${taskItem.actid}&action=taskticket`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Origin': `https://wzq.tenpay.com`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `wzq.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://wzq.tenpay.com/mp/v2/index.html`,
                'Accept-Language': `zh-cn`
            },
        };
        $.post(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        wxticket = data.task_ticket
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//微信任务列表查询
async function wxTaskListQuery(taskItem,printDebug=0) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_${taskItem.activity}.fcgi?action=home&type=${taskItem.type}&actid=${taskItem.actid}&invite_code=&_=${rndtime}`,
            headers: {
                'Cookie': wx_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': wx_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        if (data.retcode == 0) {
                            if(data.task_pkg != null && data.task_pkg.length > 0){
                                scanList.push(taskItem.actid)
                                if(printDebug) {
                                    //console.log(data)
                                    console.log(`===================== actid=${taskItem.actid} start ======================`)
                                    for(i=0; i<data.task_pkg[0].tasks.length; i++){
                                        resultItem = data.task_pkg[0].tasks[i]
                                        console.log(resultItem)
                                    }
                                    console.log(`===================== actid=${taskItem.actid} end ======================`)
                                }
                            }
                        } else {
                            console.log(`${taskItem.taskName}查询失败，错误信息：${JSON.stringify(data)}`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//做WX任务
function wxTaskDone(taskItem,wxticket,task_id,task_tid) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_task.fcgi?t=${rndtime}`,
            body: `_h5ver=2.0.1&actid=${taskItem.actid}&tid=${task_tid}&id=${task_id}&task_ticket=${wxticket}&action=taskdone`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Origin': `https://wzq.tenpay.com`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `wzq.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://wzq.tenpay.com/mp/v2/index.html`,
                'Accept-Language': `zh-cn`
            },
        };
        $.post(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let task = JSON.parse(data)
                        //console.log(task)
                        if(task.retcode == 0){
                            $.log(`完成${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]:获得 ${task.reward_desc}\n`);
                            await $.wait(10000); //等待10秒
                        } else {
                            $.log(`${taskItem.taskName}[actid:${taskItem.actid},id:${task_id},tid:${task_tid}]未完成：${task.retmsg}\n`);
                            await $.wait(100);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//提现查询
function orderQuery(getNameOnly) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let testurl = {
            url: `https://zqact03.tenpay.com/cgi-bin/shop.fcgi?action=home_v2&type=2&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `https://zqact03.tenpay.com/activity/page/exchangeRights/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `zqact03.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-CN,zh-Hans;q=0.9`
            },
        }
        $.get(testurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        //console.log(result)
                        if(result.retcode == 0){
                            if(getNameOnly > 0) {
                                $.log(`获取账户${numUser}昵称成功：${result.shop_asset.nickname}\n`);
                                nickname.push(result.shop_asset.nickname)
                            } else {
                                if(cash != 0){
                                    if(result.cash != null && result.cash.length > 0){
                                        let cashStr = `${cash}元现金`
                                        for(k=0; k<result.cash.length; k++){
                                            cashItem = result.cash[k]
                                            //console.log(cashItem)
                                            if(cashItem.item_desc == cashStr){
                                                $.log(`提现${cashItem.item_desc}，需要${cashItem.coins}金币\n`);
                                                if(coinInfo-cashItem.coins >= 0){
                                                    $.log(`账户金币余额多于${cashItem.coins}，开始提现\n`);
                                                    await cashTicket(cashItem.item_id)
                                                } else {
                                                    $.log(`账户金币余额少于${cashItem.coins}\n`);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            $.log(`提现列表获取失败：${task.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//提现票据
function cashTicket(item_id) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://zqact03.tenpay.com/cgi-bin/shop.fcgi?action=order_ticket&type=2&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `https://zqact03.tenpay.com/activity/page/exchangeRights/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `zqact03.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-CN,zh-Hans;q=0.9`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        if(result.retcode == 0){
                            await getcash(result.ticket,item_id)
                        } else {
                            $.log(`提现票据申请失败：${task.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//提现请求
function getcash(cashticketFb,item_id) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://zqact03.tenpay.com/cgi-bin/shop.fcgi?action=order&type=2&ticket=${cashticketFb}&item_id=${item_id}&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `https://zqact03.tenpay.com/activity/page/exchangeRights/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `zqact03.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-CN,zh-Hans;q=0.9`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        data = JSON.parse(data);
                        if(data.retcode == 0){
                            $.log(`提现结果:${data.retmsg}`);
                            $.log(`查询剩余金额：\n`);
                            await userhome();
                        } else {
                            $.log(`提现失败：${data.retmsg}\n`)
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//金币查询
async function userhome() {
    return new Promise((resolve) => {
        let signurl = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_usercenter.fcgi?channel=1&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Referer': `http://zixuanguapp.finance.qq.com`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Encoding': `gzip,deflate`,
                'Accept-Language': `zh-Hans-CN;q=1`
            },
        };
        $.get(signurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        money = JSON.parse(data);
                        $.log(`账户金币:${money.icon_amount}金币\n`);
                        coinInfo = money.icon_amount
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//APP长牛任务
async function bullTask(taskItem, extra="") {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let signurl = {
            url: `https://zqact03.tenpay.com/cgi-bin/activity_year_party.fcgi?type=bullish&action=${taskItem.action}&actid=${taskItem.actid}${extra}&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `https://zqact03.tenpay.com/activity/page/raisebull/`,
                'Host': `zqact03.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Encoding': `gzip, deflate, br`,
                'Accept-Language': `zh-CN,zh-Hans;q=0.9`
            },
        };
        $.get(signurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        //console.log(result)
                        if(result.retcode == 0) {
                            if(result.forbidden_code > 0) {
                                $.log(`结束${taskItem.taskName}：${result.forbidden_reason}\n`);
                                //console.log(result)
                            } else if(result.reward_info) {
                                $.log(`${taskItem.taskName}获得: ${result.reward_info[0].reward_desc}\n`);
                                await $.wait(Math.random()*2000+7000)
                                await bullTask(taskItem)
                            } else if(result.award_desc) {
                                $.log(`${taskItem.taskName}获得: ${result.award_desc}\n`);
                                await $.wait(Math.random()*1000+2000)
                            } else if(result.skin_info) {
                                $.log(`${taskItem.taskName}获得: ${result.skin_info.skin_desc}\n`);
                                await $.wait(Math.random()*2000+3000)
                                await bullTask(taskItem)
                            } else if(result.skin_list) {
                                numItem = result.skin_list.length
                                for(j=0; j<numItem; j++) {
                                    skinItem = result.skin_list[j] - 1
                                    if(skinItem.skin_num > 1) {
                                        numSell = skinItem.skin_num
                                        $.log(`卖出${numSell}个${skinItem.skin_desc}\n`);
                                        for(k=0; k<numSell; k++) {
                                            await bullTask(bullTaskArray["sell_skin"],`&skin_type=${skinItem.skin_type}`)
                                        }
                                    }
                                }
                            } else if(result.feed_reward_info) {
                                $.log(`${taskItem.taskName}获得: ${result.feed_reward_info.reward_desc}\n`);
                                if(result.level_up_status == 1) {
                                $.log(`长牛升级到等级${result.update_new_level}，获得: ${result.level_reward_info.reward_desc}\n`);
                            }
                                await $.wait(Math.random()*3000+6000)
                                await bullTask(taskItem)
                            } else {
                                console.log(result)
                            } 
                        } else {
                        $.log(`${taskItem.taskName}失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//APP长牛状态+获取互助码
async function bullStatus() {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let signurl = {
            url: `https://zqact03.tenpay.com/cgi-bin/activity_year_party.fcgi?invite_code=&help_code=&share_date=&type=bullish&action=home&actid=1105&_=${rndtime}&openid=${app_openid}&fskey=${app_fskey}&channel=1&access_token=${app_token}&_appName=${app_appName}&_appver=${app_appver}&_osVer=${app_osVer}&_devId=${app_devId}`,
            headers: {
                'Cookie': app_ck,
                'Accept': `*/*`,
                'Connection': `keep-alive`,
                'Referer': `https://zqact03.tenpay.com/activity/page/raisebull/`,
                'Host': `zqact03.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Encoding': `gzip, deflate, br`,
                'Accept-Language': `zh-CN,zh-Hans;q=0.9`
            },
        };
        $.get(signurl, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        //console.log(result)
                        if(result.retcode == 0) {
                            bullInviteCodeArr.push(result.invite_code)
                            bullHelpCodeArr.push(result.help_code)
                            $.log(`长牛状态：\n`)
                            $.log(`等级: ${result.bullish_info.level}\n`)
                            $.log(`下一级需要经验: ${result.bullish_info.next_level_exp}\n`)
                            $.log(`现有经验: ${result.bullish_info.exp_value}\n`)
                            $.log(`现有牛气: ${result.bullish_info.bullish_value}，开始喂食\n`)
                            if(result.bullish_info.bullish_value >= 500) {
                                await bullTask(bullTaskArray["feed"])
                            }
                        } else {
                            $.log(`查询长牛状态失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//长牛互助邀请
function bullInvite(inviteCode="",helpCode="") {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let url = {
            url: `https://zqact03.tenpay.com/cgi-bin/activity_year_party.fcgi?invite_code=${inviteCode}&help_code=${helpCode}&share_date=${signday}&type=bullish&action=home&actid=1105&_=${rndtime}`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `zqact03.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://zqact03.tenpay.com/activity/page/raisebull/?inviteCode=${inviteCode}&helpCode=${helpCode}&date=${signday}`,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        //console.log(result)
                        if(result.retcode == 0){
                            await bullHelpReward(inviteCode,helpCode)
                            await $.wait(1000)
                        } else {
                            $.log(`长牛互助邀请失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//长牛互助奖励
function bullHelpReward(inviteCode="",helpCode="") {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let url = {
            url: `https://zqact03.tenpay.com/cgi-bin/activity_year_party.fcgi?type=bullish&action=help&actid=1105&help_code=${helpCode}&share_date=${signday}&_=${rndtime}`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `zqact03.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://zqact03.tenpay.com/activity/page/raisebull/?inviteCode=${inviteCode}&helpCode=${helpCode}&date=${signday}&_=${rndtime}`,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        //console.log(result)
                        if(result.retcode == 0){
                            if(result.forbidden_code > 0){
                                $.log(`长牛互助获取奖励失败：${result.forbidden_reason}\n`);
                            } else {
                                $.log(`长牛互助获得：${result.reward_info.reward_desc}\n`);
                            }
                        } else {
                            $.log(`长牛互助获取奖励失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//分享任务-APP端发起
async function appShareTaskReq(share_type) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity/activity_share.fcgi?channel=1&action=query_share_code&share_type=${share_type}&_rndtime=${rndtime}&_appName=${app_appName}&_dev=iPhone13,2&_devId=${app_devId}&_appver=9.5.0&_ifChId=&_isChId=1&_osVer=15.0&openid=${app_openid}&fskey=${app_fskey}&access_token=${app_token}&buildType=store&check=11&_idfa=&lang=zh_CN`,
            headers: {
                'Cookie': app_ck,
                'Accept': `application/json, text/plain, */*`,
                'Connection': `keep-alive`,
                'Referer': `https://wzq.tenpay.com/activity/page/welwareCenter/`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Host': `wzq.tenpay.com`,
                'User-Agent': app_UA,
                'Accept-Language': `zh-cn`
            },
        };
        $.get(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        //console.log(result)
                        if(result.retcode == 0) {
                            if(!userAppShareCodeArr[share_type]) {
                                userAppShareCodeArr[share_type] = []
                            }
                            userAppShareCodeArr[share_type].push(result.share_code)
                            $.log(`获取用户${nickname[numUser]}的APP的${share_type}互助码: ${result.share_code}\n`);
                        } else {
                            $.log(`获取用户${nickname[numUser]}的APP的${share_type}互助码失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

//分享任务-微信端发起
function wxShareTaskReq(share_type) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_share.fcgi?t=${rndtime}`,
            body: `_h5ver=2.0.1&action=query_share_code&share_type=${share_type}`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Origin': `https://wzq.tenpay.com`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `wzq.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://wzq.tenpay.com/mp/v2/index.html`,
                'Accept-Language': `zh-cn`
            },
        };
        $.post(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        //console.log(data)
                        if(result.retcode == 0) {
                            if(!userWxShareCodeArr[share_type]) {
                                userWxShareCodeArr[share_type] = []
                            }
                            userWxShareCodeArr[share_type].push(result.share_code)
                            $.log(`获取用户${nickname[numUser]}的微信的${share_type}互助码: ${result.share_code}\n`);
                        } else {
                            $.log(`获取用户${nickname[numUser]}的微信的${share_type}互助码失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

//分享任务-微信端完成
function wxShareTaskDone(share_type,share_code) {
    rndtime = Math.round(new Date().getTime())
    return new Promise((resolve, reject) => {
        let url = {
            url: `https://wzq.tenpay.com/cgi-bin/activity_share.fcgi?t=${rndtime}`,
            body: `_h5ver=2.0.1&action=share_code_info&share_type=${share_type}&share_code=${share_code}`,
            headers: {
                'Accept': `application/json, text/plain, */*`,
                'Origin': `https://wzq.tenpay.com`,
                'Accept-Encoding': `gzip, deflate, br`,
                'Cookie': wx_ck,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Host': `wzq.tenpay.com`,
                'Connection': `keep-alive`,
                'User-Agent': wx_UA,
                'Referer': `https://wzq.tenpay.com/mp/v2/index.html`,
                'Accept-Language': `zh-cn`
            },
        };
        $.post(url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("腾讯自选股: API查询请求失败 ‼️‼️");
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        result = JSON.parse(data);
                        //console.log(data)
                        if(result.retcode == 0) {
                            if(result.share_code_info && result.share_code_info.status == 1) {
                                $.log(`${share_type}互助成功：对方昵称 ${result.share_code_info.nickname}\n`);
                            } else if(result.retmsg == "OK") {
                                $.log(`${share_type}已经互助过了\n`);
                            } else {
                                console.log(result)
                            }
                            await $.wait(1000)
                        } else {
                            $.log(`${share_type}互助失败：${result.retmsg}\n`);
                        }
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        })
    })
}

////////////////////////////////////////////////////////////////////

function time(time) {
  var date = new Date(time + 8 * 3600 * 1000);
  return date.toJSON().substr(0, 19).replace('T', ' ').replace(/-/g, '.');
}

function safeGet(data) {
  try {
    if (typeof JSON.parse(data) == "object") {
      return true;
    }
  } catch (e) {
    console.log(e);
    console.log(`服务器访问数据为空，请检查自身设备网络情况`);
    return false;
  }
}

function formatDateTime(inputTime) {
  var date = new Date(inputTime);
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  m = m < 10 ? ('0' + m) : m;
  var d = date.getDate();
  d = d < 10 ? ('0' + d) : d;
  var h = date.getHours();
  h = h < 10 ? ('0' + h) : h;
  var minute = date.getMinutes();
  var second = date.getSeconds();
  minute = minute < 10 ? ('0' + minute) : minute;
  second = second < 10 ? ('0' + second) : second;
  return `${y}${m}${d}`;
};

function Env(t, e) {
  class s {
    constructor(t) {
      this.env = t
    }
    send(t, e = "GET") {
      t = "string" == typeof t ? {
        url: t
      } : t;
      let s = this.get;
      return "POST" === e && (s = this.post), new Promise((e, i) => {
        s.call(this, t, (t, s, r) => {
          t ? i(t) : e(s)
        })
      })
    }
    get(t) {
      return this.send.call(this.env, t)
    }
    post(t) {
      return this.send.call(this.env, t, "POST")
    }
  }
  return new class {
    constructor(t, e) {
      this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `\ud83d\udd14${this.name}, \u5f00\u59cb!`)
    }
    isNode() {
      return "undefined" != typeof module && !!module.exports
    }
    isQuanX() {
      return "undefined" != typeof $task
    }
    isSurge() {
      return "undefined" != typeof $httpClient && "undefined" == typeof $loon
    }
    isLoon() {
      return "undefined" != typeof $loon
    }
    toObj(t, e = null) {
      try {
        return JSON.parse(t)
      } catch {
        return e
      }
    }
    toStr(t, e = null) {
      try {
        return JSON.stringify(t)
      } catch {
        return e
      }
    }
    getjson(t, e) {
      let s = e;
      const i = this.getdata(t);
      if (i) try {
        s = JSON.parse(this.getdata(t))
      } catch {}
      return s
    }
    setjson(t, e) {
      try {
        return this.setdata(JSON.stringify(t), e)
      } catch {
        return !1
      }
    }
    getScript(t) {
      return new Promise(e => {
        this.get({
          url: t
        }, (t, s, i) => e(i))
      })
    }
    runScript(t, e) {
      return new Promise(s => {
        let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
        i = i ? i.replace(/\n/g, "").trim() : i;
        let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
        r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r;
        const [o, h] = i.split("@"), a = {
          url: `http://${h}/v1/scripting/evaluate`,
          body: {
            script_text: t,
            mock_type: "cron",
            timeout: r
          },
          headers: {
            "X-Key": o,
            Accept: "*/*"
          }
        };
        this.post(a, (t, e, i) => s(i))
      }).catch(t => this.logErr(t))
    }
    loaddata() {
      if (!this.isNode()) return {}; {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          i = !s && this.fs.existsSync(e);
        if (!s && !i) return {}; {
          const i = s ? t : e;
          try {
            return JSON.parse(this.fs.readFileSync(i))
          } catch (t) {
            return {}
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          i = !s && this.fs.existsSync(e),
          r = JSON.stringify(this.data);
        s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r)
      }
    }
    lodash_get(t, e, s) {
      const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
      let r = t;
      for (const t of i)
        if (r = Object(r)[t], void 0 === r) return s;
      return r
    }
    lodash_set(t, e, s) {
      return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t)
    }
    getdata(t) {
      let e = this.getval(t);
      if (/^@/.test(t)) {
        const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : "";
        if (r) try {
          const t = JSON.parse(r);
          e = t ? this.lodash_get(t, i, "") : e
        } catch (t) {
          e = ""
        }
      }
      return e
    }
    setdata(t, e) {
      let s = !1;
      if (/^@/.test(e)) {
        const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}";
        try {
          const e = JSON.parse(h);
          this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i)
        } catch (e) {
          const o = {};
          this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i)
        }
      } else s = this.setval(t, e);
      return s
    }
    getval(t) {
      return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null
    }
    setval(t, e) {
      return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null
    }
    initGotEnv(t) {
      this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))
    }
    get(t, e = (() => {})) {
      t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
        "X-Surge-Skip-Scripting": !1
      })), $httpClient.get(t, (t, s, i) => {
        !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
      })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
        hints: !1
      })), $task.fetch(t).then(t => {
        const {
          statusCode: s,
          statusCode: i,
          headers: r,
          body: o
        } = t;
        e(null, {
          status: s,
          statusCode: i,
          headers: r,
          body: o
        }, o)
      }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => {
        try {
          if (t.headers["set-cookie"]) {
            const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
            this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar
          }
        } catch (t) {
          this.logErr(t)
        }
      }).then(t => {
        const {
          statusCode: s,
          statusCode: i,
          headers: r,
          body: o
        } = t;
        e(null, {
          status: s,
          statusCode: i,
          headers: r,
          body: o
        }, o)
      }, t => {
        const {
          message: s,
          response: i
        } = t;
        e(s, i, i && i.body)
      }))
    }
    post(t, e = (() => {})) {
      if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
        "X-Surge-Skip-Scripting": !1
      })), $httpClient.post(t, (t, s, i) => {
        !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
      });
      else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
        hints: !1
      })), $task.fetch(t).then(t => {
        const {
          statusCode: s,
          statusCode: i,
          headers: r,
          body: o
        } = t;
        e(null, {
          status: s,
          statusCode: i,
          headers: r,
          body: o
        }, o)
      }, t => e(t));
      else if (this.isNode()) {
        this.initGotEnv(t);
        const {
          url: s,
          ...i
        } = t;
        this.got.post(s, i).then(t => {
          const {
            statusCode: s,
            statusCode: i,
            headers: r,
            body: o
          } = t;
          e(null, {
            status: s,
            statusCode: i,
            headers: r,
            body: o
          }, o)
        }, t => {
          const {
            message: s,
            response: i
          } = t;
          e(s, i, i && i.body)
        })
      }
    }
    time(t) {
      let e = {
        "M+": (new Date).getMonth() + 1,
        "d+": (new Date).getDate(),
        "H+": (new Date).getHours(),
        "m+": (new Date).getMinutes(),
        "s+": (new Date).getSeconds(),
        "q+": Math.floor(((new Date).getMonth() + 3) / 3),
        S: (new Date).getMilliseconds()
      };
      /(y+)/.test(t) && (t = t.replace(RegExp.$1, ((new Date).getFullYear() + "").substr(4 - RegExp.$1.length)));
      for (let s in e) new RegExp("(" + s + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? e[s] : ("00" + e[s]).substr(("" + e[s]).length)));
      return t
    }
    msg(e = t, s = "", i = "", r) {
      const o = t => {
        if (!t) return t;
        if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? {
          "open-url": t
        } : this.isSurge() ? {
          url: t
        } : void 0;
        if ("object" == typeof t) {
          if (this.isLoon()) {
            let e = t.openUrl || t.url || t["open-url"],
              s = t.mediaUrl || t["media-url"];
            return {
              openUrl: e,
              mediaUrl: s
            }
          }
          if (this.isQuanX()) {
            let e = t["open-url"] || t.url || t.openUrl,
              s = t["media-url"] || t.mediaUrl;
            return {
              "open-url": e,
              "media-url": s
            }
          }
          if (this.isSurge()) {
            let e = t.url || t.openUrl || t["open-url"];
            return {
              url: e
            }
          }
        }
      };
      this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r)));
      let h = ["", "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];
      h.push(e), s && h.push(s), i && h.push(i), console.log(h.join("\n")), this.logs = this.logs.concat(h)
    }
    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator))
    }
    logErr(t, e) {
      const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
      s ? this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack) : this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t)
    }
    wait(t) {
      return new Promise(e => setTimeout(e, t))
    }
    done(t = {}) {
      const e = (new Date).getTime(),
        s = (e - this.startTime) / 1e3;
      this.log("", `\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t)
    }
  }(t, e)
}

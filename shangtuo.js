/*
商拓

下载地址：
复制链接后，在微信里打开：
https://shatuvip.com/pages/login/register?recom_code=5290130

或微信扫描二维码下载
https://raw.githubusercontent.com/leafxcy/JavaScript/main/shangtuo.jpg

推荐码: 5290130

自动看广告，得分红金和抢券。抢到的券可以出售然后提现，最低提现0.5。分红金每日会产生分红，但是需要满88才能提现
脚本满0.5自动提现，提现需要上传支付宝和微信收款码
CK有效期较短，可能几天后需要重新捉
测试过V2P，青龙可以跑

青龙：
捉api.shatuvip.com的包，大部分包里都有Authorization和User-Agent，分别保存在shangtuoAuth和shangtuoUA里
多账号用@分开，例子如下：
export shangtuoAuth="asdfjhkjafqweqwe@askjfbhsakjeh"
export shangtuoUA="UA1@UA2"

V2P，圈X重写食用:
打开商拓即可，如果没有获取到，刷新一下广告首页

[task_local]
#商拓
30 0 * * * shangtuo.js, tag=商拓, enabled=true

[rewrite_local]
https://api.shatuvip.com/advert/getAdvertPage? url script-request-header https://raw.githubusercontent.com/leafxcy/JavaScript/main/shangtuo.js

[MITM]
hostname = api.shatuvip.com

*/


const $ = new Env('商拓');
let shangtuoAuthArr = []
let shangtuoUAArr = []
let shangtuoAuth = ''
let shangtuoUA = ''
let userNum = 0
let userInfo = ""

let secretCode

let compTaskFlag
let grabFlag
let grabCount

let logDebug = 0
let logCaller = 0

const notify = $.isNode() ? require('./sendNotify') : '';

!(async () => {
    if (typeof $request !== "undefined") {
        await getRewrite()
    } else {
        
        if(await checkEnv()) {
            
            console.log(`共${shangtuoAuthArr.length}个账号\n`)
            for (userNum = 0; userNum < shangtuoAuthArr.length; userNum++) {
                
                if (shangtuoAuthArr[userNum]) {
                    shangtuoAuth = shangtuoAuthArr[userNum];
                    shangtuoUA = shangtuoUAArr[userNum]
                    accountStatus = 1
                    
                    console.log(`\n=================== 开始账户${userNum + 1} ===================`)
                    
                    await getUserInfoData(1)
                    await $.wait(1000);
                    
                    if(accountStatus) {
                        await getAdvertPage(1);
                        await $.wait(1000);
                        
                        await changeDividendBonusToBalance();
                        await $.wait(1000);
                        
                        await getTradeToPage(1);
                        await $.wait(1000);
                        
                        await getBondList(1);
                        await $.wait(1000);
                        
                        await getBalanceWithdrawalData();
                        await $.wait(1000);
                        
                        await getUserInfoData(0)
                        await $.wait(1000);
                    }
                }
            }

            $.msg(userInfo)
            if($.isNode()) await notify.sendNotify($.name, userInfo)
        }
    }

})()
.catch((e) => $.logErr(e))
.finally(() => $.done())

function checkEnv() {
    
    let shangtuoAuths = $.isNode() ? (process.env.shangtuoAuth) : ($.getval('shangtuoAuth'))
    let shangtuoUAs = $.isNode() ? (process.env.shangtuoUA) : ($.getval('shangtuoUA'))
    
    if(!shangtuoAuths || !shangtuoUAs) {
        str1 = shangtuoAuths ? "" : "shangtuoAuths"
        str2 = shangtuoUAs ? "" : "shangtuoUAs"
        $.log(`未找到环境变量: ${str1} ${str2}，请重新捉包并正确填写\n`)
        return false
    }
    
    let shangtuoAuthArrs
    if (shangtuoAuths.indexOf('#') > -1) {
        shangtuoAuthArrs = shangtuoAuths.split('#');
        console.log(`您选择的是用"#"隔开shangtuoAuth\n`)
    } else if (shangtuoAuths.indexOf('@') > -1) {
        shangtuoAuthArrs = shangtuoAuths.split('@');
        console.log(`您选择的是用"@"隔开shangtuoAuth\n`)
    } else {
        shangtuoAuthArrs = [shangtuoAuths]
    };
    Object.keys(shangtuoAuthArrs).forEach((item) => {
        if (shangtuoAuthArrs[item]) {
            shangtuoAuthArr.push(shangtuoAuthArrs[item])
        }
    })
    
    let shangtuoUAArrs
    if (shangtuoUAs.indexOf('#') > -1) {
        shangtuoUAArrs = shangtuoUAs.split('#');
        console.log(`您选择的是用"#"隔开shangtuoUA\n`)
    } else if (shangtuoUAs.indexOf('@') > -1) {
        shangtuoUAArrs = shangtuoUAs.split('@');
        console.log(`您选择的是用"@"隔开shangtuoUA\n`)
    } else {
        shangtuoUAArrs = [shangtuoUAs]
    };
    Object.keys(shangtuoUAArrs).forEach((item) => {
        if (shangtuoUAArrs[item]) {
            shangtuoUAArr.push(shangtuoUAArrs[item])
        }
    })
    
    return true
}

function getRewrite() {
    if ($request.url.indexOf("getAdvertPage?") > -1) {
        shangtuoAuth = $request.headers['Authorization']
        if (shangtuoAuth) {
            $.setdata(shangtuoAuth, `shangtuoAuth`)
            $.log(`获取shangtuoAuth成功：${shangtuoAuth}`)
            $.msg(`获取shangtuoAuth成功：${shangtuoAuth}`)
        }
        
        shangtuoUA = $request.headers['User-Agent']
        if (shangtuoUA) {
            $.setdata(shangtuoUA, `shangtuoUA`)
            $.log(`获取shangtuoUA成功：${shangtuoUA}`)
            $.msg(`获取shangtuoUA成功：${shangtuoUA}`)
        }
    }
}

//用户信息
function getUserInfoData(checkStatus,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/user/getUserInfoData`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }

        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            if(checkStatus) {
                                console.log(`\n账户${userNum+1}名称：${result.result.nickname}`)
                                userInfo += `\n账户${userNum+1}名称：${result.result.nickname}\n`
                            } else {
                                console.log(`\n账户${userNum+1}名称：${result.result.nickname}`)
                                console.log(`  推荐码：    ${result.result.recom_code}`)
                                userInfo += `  推荐码：    ${result.result.recom_code}\n`
                                console.log(`  分红金总额：${result.result.dividend}`)
                                userInfo += `  分红金总额：${result.result.dividend}\n`
                                console.log(`  分红余额：  ${result.result.balance_with}`)
                                userInfo += `  分红余额：  ${result.result.balance_with}\n`
                                console.log(`  红包余额：  ${result.result.balance_packet}`)
                                userInfo += `  红包余额：  ${result.result.balance_packet}\n`
                                console.log(`  推广余额：  ${result.result.balance_extend}`)
                                userInfo += `  推广余额：  ${result.result.balance_extend}\n`
                                console.log(`  可售商券：  ${result.result.bond_count}`)
                                userInfo += `  可售商券：  ${result.result.bond_count}\n`
                                console.log(`  消费余额：  ${result.result.balance}`)
                                userInfo += `  消费余额：  ${result.result.balance}\n`
                                console.log(`  消费商券：  ${result.result.balance_bonds}`)
                                userInfo += `  消费商券：  ${result.result.balance_bonds}\n`
                            }
                        } else {
                            console.log(`\n获取账户${userNum+1}信息失败: ${result.msg}`)
                            if(result.msg.indexOf('登录超时') > -1) {
                                accountStatus = 0
                                userInfo += `\n获取账户${userNum+1}信息失败: ${result.msg}，请尝试重新捉CK\n`
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//广告列表id
function getAdvertPage(pageNo,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve) => {
        let request = {
            url: `https://api.shatuvip.com/advert/getAdvertPage?type=1&pageNo=${pageNo}&column_id=1`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            console.log(`获取分红金广告任务列表成功`)
                            adNum = result.result.length
                            compTaskFlag = 1
                            for(let i=0; i<adNum && compTaskFlag; i++) {
                                compTaskFlag = 0
                                cid = result.result[i].id
                                await getAdvertInfo(cid)
                                await completeTask(cid,secretCode)
                            }
                        } else {
                            console.log(`获取分红金广告任务列表失败: ${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//浏览广告
function getAdvertInfo(cid,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve) => {
        let request = {
            url: `https://api.shatuvip.com/advert/getAdvertInfo?id=${cid}`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }

        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            console.log(`开始浏览广告${cid}`)
                            secretCode = result.result.uniTime2
                            await $.wait(6000);
                        } else {
                            console.log(`浏览广告失败: ${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//获取分红金
function completeTask(cid,secret,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/advert/completeTask`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
            body: `{"id": ${cid}, "secret": "${secret}"}`,
        }

        $.post(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            if(result.msg) {
                                console.log(`获得${result.msg}`)
                                compTaskFlag = 1
                            } else {
                                console.log(`没有获得分红金，结束浏览广告`)
                            }
                        } else {
                            console.log(`获取分红金失败：${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//提取分红金
function changeDividendBonusToBalance(timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/user/changeDividendBonusToBalance`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if(result.code == 0) {
                            console.log(`提取分红金获得: ${result.result.bonus}`)
                            userInfo += `提取分红金获得: ${result.result.bonus}\n`
                        } else {
                            console.log(`提取分红金失败: ${result.msg}`)
                        }
                        
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//出售券列表
function getTradeToPage(pageNo,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve) => {
        let request = {
            url: `https://api.shatuvip.com/user/getTradeToPage?pageNo=${pageNo}`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            for (i = 0; i < result.result.length; i++) {
                                quanItem = result.result[i]
                                if(quanItem.locking) {
                                    console.log(`${quanItem.price}券${quanItem.id}出售等待时间：${quanItem.locking}`)
                                } else {
                                    await getPriceSection(quanItem.id,quanItem.price)
                                }
                            }
                        } else {
                            console.log(`获取出售券列表失败: ${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//设置券出售金额
function getPriceSection(id,price,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve) => {
        let request = {
            url: `https://api.shatuvip.com/market/getPriceSection?id=${id}`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            sellPrice = result.result.min
                            console.log(`${price}券可出售金额为${result.result.min}到${result.result.max}，设置为${sellPrice}`)
                            await tradePutShop(id,price,sellPrice)
                        } else {
                            console.log(`获取券可出售金额失败: ${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//券出售
function tradePutShop(id,price,sellPrice,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/user/tradePutShop`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
            body: `{"id": ${id}, "price": "${sellPrice}"}`,
        }
        
        $.post(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        console.log(`出售${price}券结果：${result.msg}`)
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//抢券列表
function getBondList(pageNo,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/bond/getBondList?pageNo=${pageNo}`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            console.log(`获取抢券广告任务列表ID成功`)
                            let numList = result.result.length
                            for(let i=0; i<numList; i++) {
                                quanItem = result.result[i]
                                //每个券可以抢10次，必须抢完10次才能抢下一个券
                                //为了防止网络波动，强制循环抢同一个券直到失败
                                grabFlag = 1
                                grabCount = 0
                                while(grabFlag && grabCount<50) {
                                    await getBondAdvertId(quanItem.face_price,quanItem.id)
                                }
                            }
                            await $.wait(1000);
                        } else {
                            console.log(`获取抢券广告列表失败：${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//获取抢券广告id
function getBondAdvertId(face_price,id,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/advert/getBondAdvertId`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            await getAdvertInfo(result.result.id);
                            await grab(face_price,id,result.result.token)
                        } else {
                            console.log(`获取抢券广告ID失败：${result.msg}`)
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}


//抢券
function grab(face_price,id,token,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    grabCount++
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/bond/grab`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
            body: `{"bond_id": ${id}, "__token__": "${token}"}`,
        }
        
        $.post(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if (result.code == 0) {
                            console.log(`抢${face_price}券成功：${result.msg}`)
                            await $.wait(1000)
                        } else {
                            console.log(`抢${face_price}券失败：${result.msg}`)
                            grabFlag = 0
                        }
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
        
    })
}

//提现列表
function getBalanceWithdrawalData(timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/withdrawal/getBalanceWithdrawalData?type=1`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if(result.code == 0) {
                            for(let i=0; i<result.result.list.length; i++) {
                                let withdrawItem = result.result.list[i]
                                if(withdrawItem.balance == 0.5) {
                                    await queryWithdrawId(withdrawItem.id,withdrawItem.balance)
                                }
                            }
                        } else {
                            console.log(`查询提现列表失败：${result.msg}`)
                        }
                        await $.wait(1000);
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//提现ID查询
function queryWithdrawId(id,balance,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/withdrawal/with?withdrawal_id=${id}`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
        }
        
        $.get(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if(result.code == 0) {
                            let withdrawFee = result.result["with"]
                            let withdrawMoney = balance - withdrawFee
                            console.log(`发起提现${balance}元，手续费${withdrawFee}，到手${withdrawMoney}`)
                            await balanceWithdrawal(id,withdrawMoney)
                        } else {
                            console.log(`查询提现ID${id}失败：${result.msg}`)
                        }
                        await $.wait(1000);
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}

//提现
function balanceWithdrawal(id,withdrawMoney,timeout = 0) {
    if(logCaller) console.log("call "+ printCaller())
    return new Promise((resolve, reject) => {
        let request = {
            url: `https://api.shatuvip.com/withdrawal/balanceWithdrawal`,
            headers: {
                "Host": "api.shatuvip.com",
                "Origin": "https://shatuvip.com",
                "Connection": "keep-alive",
                "Authorization": shangtuoAuth,
                "User-Agent": shangtuoUA,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": "https://shatuvip.com/",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
            body: `{"id": "${id}", "type": "1"}`,
        }
        
        $.post(request, async (err, resp, data) => {
            try {
                if (err) {
                    console.log("API请求失败");
                    
                    console.log(err + " at function " + printCaller());
                } else {
                    if (safeGet(data)) {
                        let result = JSON.parse(data)
                        if(logDebug) console.log(result)
                        if(result.code == 0) {
                            console.log(`${result.msg}，预计到账${withdrawMoney}元`)
                            userInfo += `${result.msg}，预计到账${withdrawMoney}元\n`
                        } else {
                            console.log(`提现失败：${result.msg}`)
                        }
                        await $.wait(1000);
                    }
                }
            } catch (e) {
                console.log(e + " at function " + printCaller(), resp);
            } finally {
                resolve();
            }
        })
    })
}


//===========================================================================================
function safeGet(data) {
    try {
        if (typeof JSON.parse(data) == "object") {
            return true;
        }
    } catch (e) {
        console.log(e);
        console.log(`服务器访问数据为空`);
        return false;
    }
}

function printCaller(){
    return (new Error()).stack.split("\n")[2].trim().split(" ")[1]
}

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
          resp: i
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
            resp: i
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

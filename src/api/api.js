const Router = require('koa-router')
const request = require('request')
const base64url = require('base64url')
const convert = require('xml-js')
const Serialize = require('../protocol/Serialize')
const router = new Router()

router.get('/users', ctx => ctx.body = User.users.length)

router.post('/notice', async ctx => {
    const { text } = ctx.request.body
    if (text === '')
        return
    const users = User.users
    for (const user of users)
        user.send(Serialize.SystemMessage('<color=#EFE4B0>[SERVER] ' + text + '</color>'))
    console.log('[SERVER] ' + text)
    ctx.body = { status: 'SUCCESS' }
})

router.post('/charging', async ctx => {
    const {
        user_id,
        point,
        point_offer,
        device,
        ad_name,
        seq_id,
    } = ctx.request.body
    console.log(ctx.request.body)
    ctx.body = { status: 'SUCCESS' }
})

let authToken = null

async function GetVivoxAuthToken() {
    try {
        const id = 'BAEKUN5968-no98-dev-Admin'
        const pw = 'olJ1UKicSLnnW9Ku'
        const url = `https://vdx5.www.vivox.com/api2/viv_signin.php?userid=${id}&pwd=${pw}`
        await new Promise((resolve, reject) => {
            request.get(url, async (err, _, body) => {
                if (err)
                    return reject({ message: err, status: 'FAILED' })
                const data = JSON.parse(convert.xml2json(body, { compact: true }))
                authToken = data.response.level0.body.auth_token._text
                resolve({ authToken, status: 'SUCCESS' })
            })
        })
    } catch (err) {
        console.error(err)
    }
}

(async () => {
    await GetVivoxAuthToken()
})()

module.exports = router
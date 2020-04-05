const { TeamType } = require('./util/const')
const pix = require('./util/pix')
const Serialize = require('./protocol/Serialize')

class DefaultMethod {
    constructor(args = {}) { }

    doing(self, item) { }
}

class FireMethod {
    constructor(args = {}) { }

    doing(self, item) { }
}

module.exports = new Proxy({
    Fire: FireMethod,
}, {
    get: function (target, name) {
        return target.hasOwnProperty(name) ? target[name] : DefaultMethod
    }
})
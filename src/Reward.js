module.exports = class Reward {
    constructor() {
        this.init()
    }

    init() {
        this.exp = 0
        this.cash = 0
        this.coin = 0
        this.point = 0
    }

    send(self) {
        self.setUpExp(Math.floor(this.exp))
        self.setUpCash(Math.floor(this.cash))
        self.coin += Math.floor(this.coin)
        self.point += this.point
        if (self.point < 0)
            self.point = 0
        this.init()
    }
}
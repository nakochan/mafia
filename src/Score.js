module.exports = class Score {
    constructor() {
        this.init()
    }

    init() {
        this.sum = 0
        this.kill = 0
        this.death = 0
    }

    send(self) {
        self.kill += this.kill
        self.death += this.death
        this.init()
    }
}
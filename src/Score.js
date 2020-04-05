module.exports = class Score {
    constructor() {
        this.init()
    }

    init() {
        this.sum = 0
        this.win = 0
        this.lose = 0
        this.rankWin = 0
        this.rankLose = 0
    }

    send(self) {
        self.win += this.win
        self.lose += this.lose
        self.rankWin += this.rankWin
        self.rankLose += this.rankLose
        this.init()
    }
}
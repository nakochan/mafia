const Serialize = require('./protocol/Serialize')
const MafiaMode = require('./mode/MafiaMode')

module.exports = class GameMode {
    constructor(roomId) {
        this.roomId = roomId
        this.count = 0
        this.type = 0
        this.room = Room.get(this.roomId)
    }

    moveToBase(self) {
        self.teleport(2, 24, 14)
        self.send(Serialize.PlaySound(1, 'hospital'))
    }

    join(self) {
        self.game = {}
        self.setGraphics(self.pureGraphics)
        this.moveToBase(self)
    }

    leave(self) {
        self.game = {}
        self.setGraphics(self.pureGraphics)
    }

    drawEvents(self) {
        const { events } = this.room.places[self.place]
        for (const event of events)
            self.send(Serialize.CreateGameObject(event))
    }

    drawUsers(self) {
        const sameMapUsers = this.room.sameMapUsers(self.place)
        for (const user of sameMapUsers) {
            if (self === user)
                continue
            user.send(Serialize.CreateGameObject(self))
            self.send(Serialize.CreateGameObject(user))
        }
    }

    gameChat(self, message) {
        this.room.publish(Serialize.ChatMessage(self.type, self.index, `<color=#99D9EA>${self.pick}. ${self.name}</color>`, message))
    }

    hit(self, target) {
        return true
    }

    useItem(self) {
        return true
    }

    setGameTime(self, active) { }

    selectVote(self, index) { }

    doAction(self, event) {
        event.doAction(self)
        return true
    }

    update() {
        if (this.room.users.length >= 5) {
            const modes = [MafiaMode]
            const i = Math.floor(Math.random() * modes.length)
            return this.room.changeMode(modes[i])
        } else {
            if (this.count % 100 === 0)
                this.room.publish(Serialize.NoticeMessage('5명부터 시작합니다. (' + this.room.users.length + '/' + this.room.max + '명)'))
        }
        if (++this.count === 10000)
            this.count = 0
    }
}
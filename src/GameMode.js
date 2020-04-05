const { RoomType } = require('./util/const')
const Serialize = require('./protocol/Serialize')
const MafiaMode = require('./mode/MafiaMode')
const MafiaRankMode = require('./mode/MafiaRankMode')

module.exports = class GameMode {
    constructor(roomId, type) {
        this.roomId = roomId
        this.count = 0
        this.type = type
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
            user.send(Serialize.CreateGameObject(self, false, this.type === RoomType.RANK_GAME))
            self.send(Serialize.CreateGameObject(user, false, this.type === RoomType.RANK_GAME))
        }
    }

    gameChat(self, message) {
        if (this.type === RoomType.RANK_GAME)
            this.room.publish(Serialize.ChatMessage(self.type, self.index, `${self.pick}번`, message, '#99D9EA'))
        else
            this.room.publish(Serialize.ChatMessage(self.type, self.index, `${self.pick}. ${self.name}`, message, '#99D9EA'))
    }

    hit(self, target) {
        return true
    }

    useItem(self) {
        return true
    }

    setTarget(self) { }

    setGameTime(self, active) { }

    selectVote(self, index) { }

    doAction(self, event) {
        event.doAction(self)
        return true
    }

    update() {
        const min = this.type === RoomType.RANK_GAME ? 8 : 4
        if (this.room.users.length >= min) {
            if (this.type === RoomType.RANK_GAME)
                return this.room.changeMode(MafiaRankMode)
            else
                return this.room.changeMode(MafiaMode)
        } else {
            if (this.count % 100 === 0)
                this.room.publish(Serialize.NoticeMessage(min + '명부터 시작합니다. (' + this.room.users.length + '/' + this.room.max + '명)'))
        }
        if (++this.count === 10000)
            this.count = 0
    }
}
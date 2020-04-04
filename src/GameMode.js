const { RoomType } = require('./util/const')
const Serialize = require('./protocol/Serialize')
const MafiaMode = require('./mode/MafiaMode')

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
        if (this.type === RoomType.RANK_GAME) {
            const tempNames = ['김개똥', '석석동', '강강라', '아주박', '순철진', '나동탁', '검준모', '이진창', '영불손', '아간나', '임식봉', '유죽내', '앙선동', '무진라', '아삭개']
            const i = Math.floor(Math.random() * tempNames.length)
            self.name = tempNames[i]
        } else
            self.name = self.pureName
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

    setTarget(self) {

    }

    setGameTime(self, active) { }

    selectVote(self, index) { }

    doAction(self, event) {
        event.doAction(self)
        return true
    }

    update() {
        const min = this.type === RoomType.RANK_GAME ? 8 : 4
        if (this.room.users.length >= min) {
            const modes = [MafiaMode]
            const i = Math.floor(Math.random() * modes.length)
            return this.room.changeMode(modes[i])
        } else {
            if (this.count % 100 === 0)
                this.room.publish(Serialize.NoticeMessage(min + '명부터 시작합니다. (' + this.room.users.length + '/' + this.room.max + '명)'))
        }
        if (++this.count === 10000)
            this.count = 0
    }
}
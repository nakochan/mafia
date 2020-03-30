const Serialize = require('./protocol/Serialize')
const { ModeType, TeamType, JobType } = require('./util/const')
const pix = require('./util/pix')

const dr = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 0]
]

class State {
    constructor(args = {}) { }

    doAction(context, self) { }

    update(context) { }
}

class DoorState {
    constructor(args = {}) {
        this.openSound = args['openSound'] || 'door03'
        this.closeSound = args['closeSound'] || 'door04'
        this.knockSound = args['knockSound'] || 'door06'
        this.isOpen = false
        this.isAlive = true
    }

    doAction(context, self) {
        const door = context
        if (this.isAlive) {
            if (this.isOpen) {
                if (self.game.team === TeamType.RED) return
                self.publishToMap(Serialize.PlaySound(2, this.closeSound))
                door.move(-1, 0)
                this.isOpen = false
            } else {
                const max = self.game.team === TeamType.RED ? 10 : 0
                let r = parseInt(Math.random() * max)
                if (r === 0) {
                    self.publishToMap(Serialize.PlaySound(2, this.openSound))
                    door.move(1, 0)
                    this.isOpen = true
                    if (self.game.team === TeamType.RED) {
                        r = parseInt(Math.random() * 10)
                        if (r === 0) this.isAlive = false
                    }
                } else self.publishToMap(Serialize.PlaySound(2, this.knockSound))
            }
        } else self.send(Serialize.InformMessage('<color=red>오니가 철창문을 고장냈다.</color>'))
    }
}

class ManiaState {
    constructor(args = {}) {
        this.count = 0
        this.step = 0
        this.i = 0
        this.msgCount = -1
        this.message = args['message'] // || ['허허... 좀 비켜보시게나.']
        this.fixed = args['fixed']
    }

    doAction(context, self) {
        this.msgCount = (++this.msgCount) % this.message.length
        self.send(Serialize.ChatMessage(context.type, context.index, context.name, this.message[this.msgCount]))
    }

    update(context) {
        if (this.fixed) return
        const room = Room.get(context.roomId)
        if (!room) return
        if (this.step <= 0) {
            this.i = parseInt(Math.random() * 4)
            this.step = parseInt(Math.random() * 5) + 1
        }
        context.dirty = true
        let i = this.i
        --this.step
        context.direction.x = dr[i][0]
        context.direction.y = -dr[i][1]
        const direction = context.getDirection(dr[i][0], -dr[i][1])
        if (room.isPassable(context.place, context.x, context.y, direction, false) && room.isPassable(context.place, context.x + dr[i][0], context.y + dr[i][1], 10 - direction, true)) {
            context.x += dr[i][0]
            context.y += dr[i][1]
        }
        this.count++
        if (this.count % 500 == 0) {
            this.msgCount = (++this.msgCount) % this.message.length
            context.publishToMap(Serialize.ChatMessage(context.type, context.index, context.name, this.message[this.msgCount]))
        }
        if (this.count > 1500) this.count = 0
    }
}

class OtherSelfState {
    constructor(args = {}) { }

    doAction(context, self) {
        const room = Room.get(context.roomId)
        if (!room)
            return
        if (room.mode.mode !== ModeType.MAFIA)
            return
        if (context.owner < 1)
            return
        const target = User.getByUserIndex(context.owner)
        if (!target)
            return
        if (self.game.target || self.game.dead)
            return
        if (target.game.dead)
            return self.send(Serialize.NoticeMessage('죽은 사람은 대상으로 설정할 수 없습니다.'))
        if (self.game.job === JobType.DEFAULT || self.game.job === JobType.CITIZEN)
            return
        if ((self.game.job === JobType.MAFIA || self.game.JobType === JobType.POLICE || self.game.JobType === JobType.SPIRIT || self.game.JobType === JobType.GANGSTER) && self === target)
            return self.send(Serialize.NoticeMessage('자기 자신은 지정할 수 없습니다.'))
        self.game.target = target
        self.send(Serialize.NoticeMessage(target.pick + '. ' + target.name + '님을 대상으로 지정했습니다.'))
        if (self.game.job === JobType.MAFIA) {
            if (target.game.job === JobType.ARMY && target.game.life > 0) {
                self.send(Serialize.SystemMessage('<color=red>앗!! 이런 젠장... 방탄복 때문에 군인을 죽일 수 없었다.</color>'))
                target.send(Serialize.SystemMessage('<color=red>방탄복 덕분에 마피아의 총격으로부터 보호를 받았다!!</color>'))
            }
            room.publish(Serialize.PlaySound(2, 'Gun'))
        }
        if (self.game.job === JobType.POLICE) {
            if (target.game.job === JobType.MAFIA)
                self.send(Serialize.SystemMessage('<color=red>' + target.name + '님은 마피아입니다.</color>'))
            else
                self.send(Serialize.SystemMessage('<color=red>' + target.name + '님은 마피아가 아닙니다.</color>'))
        }
        if (self.game.job === JobType.DOCTOR)
            room.publish(Serialize.PlaySound(2, 'magical21'))
        if (self.game.job === JobType.SPIRIT) {
            const jobName = ["", "마피아", "시민", "경찰", "의사", "간첩", "군인", "변호사", "조폭", "무당", "매춘부", "연인", "탐정", "테러리스트", "도둑", "살인마", "영매", "버스기사"]
            self.send(Serialize.SystemMessage('<color=red>' + target.name + '님의 직업은 ' + jobName[target.game.job] + '입니다.</color>'))
        }
        if (self.game.job === JobType.GANGSTER)
            target.game.threat = true

    }

    update(context) { }
}

module.exports = new Proxy({
    door: DoorState,
    mania: ManiaState,
    otherSelf: OtherSelfState
}, {
    get: function (target, name) {
        return target.hasOwnProperty(name) ? target[name] : State
    }
})
const Serialize = require('../protocol/Serialize')
const GameMap = require('../GameMap')
const { TeamType, JobType, MapType, ModeType } = require('../util/const')
const PlayerState = require('../PlayerState')
const Event = require('../Event')
const pix = require('../util/pix')

const STATE_READY = 0
const STATE_DAY = 1
const STATE_NIGHT = 2
const STATE_SUSPECT = 3
const STATE_LAST_DITCH = 4
const STATE_VOTE = 5
const STATE_DEATH_PENALTY = 6
const STATE_RESULT = 7

module.exports = class RescueMode {
    constructor(roomId) {
        this.roomId = roomId
        this.state = STATE_READY
        this.map = MapType.TOWN
        this.mode = ModeType.MAFIA
        this.tick = 0
        this.count = 20
        this.maxCount = 20
        this.days = 0
        this.mafiaTeam = []
        this.citizenTeam = []
        this.jobs = []
        this.target = null
        this.room = Room.get(this.roomId)
        /*const objects = require('../../Assets/Mods/Mod' + ('' + this.mode).padStart(3, '0') + '.json')[this.map]
        for (const object of objects) {
            const event = new Event(this.roomId, object)
            this.room.addEvent(event)
        }*/
    }

    getJSON() {
        return {
            map: this.map,
            mode: this.mode,
            count: this.count,
            maxCount: this.maxCount,
            persons: this.citizenTeam.length
        }
    }

    gameObject() {
        return {
            team: TeamType.DEFAULT,
            job: JobType.DEFAULT,
            count: 0,
            vote: 0,
            target: null,
            dead: false,
            result: false
        }
    }

    join(self) {
        self.game = this.gameObject()
        self.game.team = TeamType.CITIZEN
        this.citizenTeam.push(self)
        switch (this.state) {
            case STATE_READY:
                self.setGraphics(self.pureGraphics)
                break
            default:
                self.game.dead = true
                self.setGraphics(self.deadGraphics)
                break
        }
        const x = [16, 26, 32, 36, 39, 30, 26, 18, 9, 12]
        const y = [10, 9, 10, 19, 30, 32, 35, 32, 30, 19]
        const sign = new Event(this.roomId, {
            "name": self.pick + ". " + self.name + "의 집",
            "place": 2,
            "x": x[self.pick - 1],
            "y": y[self.pick - 1],
            "graphics": "Sign",
            "owner": self.index,
            "collider": true,
            "action": {
                "command": ""
            }
        })
        this.room.addEvent(sign)
        this.room.publish(Serialize.CreateGameObject(sign))
        this.moveToDay(self)
        self.publishToMap(Serialize.SetGameTeam(self))
        self.send(Serialize.UpdateModeInfo(self.game.job))
        self.publish(Serialize.ModeData(this))
    }

    leave(self) {
        switch (self.game.team) {
            case TeamType.MAFIA:
                this.mafiaTeam.splice(this.mafiaTeam.indexOf(self), 1)
                break
            case TeamType.CITIZEN:
                this.citizenTeam.splice(this.citizenTeam.indexOf(self), 1)
                break
        }
        self.game = {}
        self.setGraphics(self.pureGraphics)
        const { events } = this.room.places[2]
        const event = events.filter(e => e.owner === self.index)
        if (event)
            this.room.removeEvent(event)
    }

    moveToDay(self) {
        self.teleport(1, 24, 14)
        self.send(Serialize.SwitchLight(false))
        self.send(Serialize.ToggleInput(true))
        self.send(Serialize.PlaySound(1, 'hospital'))
    }

    moveToNight(self) {
        if (self.game.dead) {
            self.teleport(2, 24, 14)
            self.send(Serialize.PlaySound(1, 'c24'))
        } else {
            if (self.game.job === JobType.CITIZEN) {
                switch (self.pick) {
                    case 1:
                        self.teleport(3, 7, 6)
                        break
                    case 2:
                        self.teleport(4, 7, 6)
                        break
                    case 3:
                        self.teleport(5, 7, 6)
                        break
                    case 4:
                        self.teleport(6, 7, 6)
                        break
                    case 5:
                        self.teleport(7, 7, 6)
                        break
                    case 6:
                        self.teleport(8, 7, 6)
                        break
                    case 7:
                        self.teleport(9, 7, 6)
                        break
                    case 8:
                        self.teleport(10, 7, 6)
                        break
                    case 9:
                        self.teleport(11, 7, 6)
                        break
                    case 10:
                        self.teleport(12, 7, 6)
                        break
                }
                self.send(Serialize.ToggleInput(false))
                self.send(Serialize.PlaySound(1, 'n14'))
            } else {
                switch (self.game.job) {
                    case JobType.MAFIA:
                        self.send(Serialize.NoticeMessage('죽일 사람의 집에 찾아가 공격 버튼을 클릭하세요...'))
                        break
                    case JobType.POLICE:
                        self.send(Serialize.NoticeMessage('마피아인지 조사할 사람의 집에 찾아가 공격 버튼을 클릭하세요...'))
                        break
                    case JobType.DOCTOR:
                        self.send(Serialize.NoticeMessage('살릴 사람의 집에 찾아가 공격 버튼을 클릭하세요...'))
                        break
                }
                self.game.target = null
                self.setGraphics('Shadow')
                self.teleport(2, 24, 14)
                self.send(Serialize.PlaySound(1, 'c24'))
            }
        }
        self.send(Serialize.SwitchLight(true))
        self.send(Serialize.NoticeMessage('밤이 되었습니다.'))
    }

    drawEvents(self) {
        const { events } = this.room.places[self.place]
        for (const event of events)
            self.send(Serialize.CreateGameObject(event))
    }

    drawUsers(self) {
        let selfHide = false
        const sameMapUsers = this.room.sameMapUsers(self.place)
        for (const user of sameMapUsers) {
            if (self === user)
                continue
            let userHide = false
            if (self.game.team !== user.game.team) {
                if (!(self.admin > 1 && user.admin > 1)) {
                    if (self.admin > 1)
                        selfHide = true
                    else if (user.admin > 1)
                        userHide = true
                    else
                        selfHide = userHide = true
                }
            }
            self.send(Serialize.CreateGameObject(user, userHide))
            user.send(Serialize.CreateGameObject(self, selfHide))
        }
    }

    hit(self, target) {
        if (self.game.target || self.game.dead || target.game.dead)
            return false
        else if (self.game.JobType === JobType.DEFAULT || self.game.JobType === JobType.CITIZEN || target.game.JobType === JobType.MAFIA)
            return false
        self.game.target = target
        self.send(Serialize.SystemMessage(target.pick + '. ' + target.name + '님을 대상으로 지정합니다.'))
        return true
    }

    useItem(self) {
        return true
    }

    selectVote(self, index) {
        if (self.game.vote > 0)
            return
        const findIndex = this.room.users.findIndex(user => user.index === index)
        if (findIndex < 0)
            return
        const user = this.room.users[findIndex]
        if (!user)
            return
        if (self.game.vote === user.index)
            return
        self.game.vote = user.index
        ++user.game.count
        this.room.publish(Serialize.SetUpVote(user))
    }

    doAction(self, event) {
        event.doAction(self)
        return true
    }

    publishToMafiaTeam(data) {
        for (const user of this.mafiaTeam)
            user.send(data)
    }

    publishToCitizenTeam(data) {
        for (const user of this.citizenTeam)
            user.send(data)
    }

    onlyLivingUser() {
        return this.room.users.filter(user => !user.game.dead)
    }

    onlyDepartedUser() {
        return this.room.users.filter(user => user.game.dead)
    }

    sameMapMafiaTeam(place) {
        return this.mafiaTeam.filter(user => user.place === place)
    }

    init() {
        this.jobs = [
            JobType.MAFIA,
            JobType.POLICE,
            JobType.DOCTOR
        ]
    }

    ready() {
        console.log("ready")
        // this.room.lock = true
        this.init()
        for (const user of this.room.users) {
            if (this.jobs.length > 0) {
                const rand = Math.floor(Math.random() * this.jobs.length)
                const job = this.jobs[rand]
                this.jobs.splice(this.jobs.indexOf(job), 1)
                if (job === JobType.MAFIA) {
                    this.citizenTeam.splice(this.citizenTeam.indexOf(user), 1)
                    this.mafiaTeam.push(user)
                    user.game.team = TeamType.MAFIA
                }
                user.game.job = job
            } else
                user.game.job = JobType.CITIZEN
            user.send(Serialize.SetGameTeam(user))
            user.send(Serialize.UpdateModeInfo(user.game.job))
        }
        this.day()
    }

    day() {
        console.log("day")
        this.count = 30
        this.state = STATE_DAY
        ++this.days
        for (const user of this.room.users) {
            user.game.count = 0
            user.game.vote = 0
            if (!user.game.dead)
                user.setGraphics(user.pureGraphics)
            user.send(Serialize.NoticeMessage(this.days + '째날 아침이 밝았습니다...'))
            this.moveToDay(user)
        }
        // this.room.publish(Serialize.PlaySound(2, 'GhostsTen'))
        this.room.publish(Serialize.ModeData(this))
    }

    checkDay() {
        console.log("checkday")
        this.count = 10
        this.state = STATE_SUSPECT
        for (const user of this.onlyLivingUser())
            user.send(Serialize.GetVote(this.onlyLivingUser()))
        this.room.publish(Serialize.ModeData(this))
    }

    suspect() {
        console.log("suspect")
        for (const user of this.onlyLivingUser())
            user.send(Serialize.CloseVote())
        const targets = this.onlyLivingUser().slice(0).sort((a, b) => b.game.count - a.game.count)
        if (targets.length < 1)
            return this.night()
        const target = targets[0]
        console.log(target)
        if (target.game.count < 1)
            return this.night()
        const checkSameVotes = targets.filter(user => user.game.count === target.game.count)
        if (checkSameVotes.length > 1)
            return this.night()
        this.target = target
        this.lastDitch()
    }

    lastDitch() {
        console.log("lastDitch")
        this.count = 10
        this.state = STATE_LAST_DITCH
        for (const user of this.room.users) {
            if (this.target === user)
                user.teleport(13, 10, 7)
            else
                user.teleport(13, 10, 13)
        }
        this.room.publish(Serialize.ModeData(this))
    }

    vote() {
        console.log("vote")
        this.state = STATE_VOTE
        if (this.target === null)
            return this.night()
        let dieCount = this.onlyLivingUser().filter(user => user.x <= 10).length
        let saveCount = this.onlyLivingUser().length - dieCount
        if (dieCount > saveCount) {
            if (this.target.game.job === JobType.MAFIA)
                this.room.publish(Serialize.SystemMessage('<color=red>마피아를 찾아냈습니다!!!</color>'))
            else
                this.room.publish(Serialize.SystemMessage('<color=red>선량한 시민이 죽었습니다...</color>'))
            this.target.game.dead = true
            this.target.setGraphics(this.target.deadGraphics)
        }
        this.target = null
        this.deathPenalty()
    }

    deathPenalty() {
        console.log("death")
        this.count = 3
        this.state = STATE_DEATH_PENALTY
        const mafiaTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.MAFIA).length
        const citizenTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.CITIZEN).length
        if (mafiaTeam >= citizenTeam)
            return this.result(TeamType.MAFIA)
        else if (mafiaTeam < 1)
            return this.result(TeamType.CITIZEN)
    }

    night() {
        console.log("night")
        this.count = 30
        this.state = STATE_NIGHT
        for (const user of this.room.users)
            this.moveToNight(user)
        this.room.publish(Serialize.ModeData(this))
    }

    checkNight() {
        console.log("checkNight")
        let target = null
        const mafia = this.onlyLivingUser().filter(user => user.game.job === JobType.MAFIA)
        if (mafia) {
            if (mafia.game.target)
                target = mafia.game.target
        }
        const police = this.onlyLivingUser().filter(user => user.game.job === JobType.POLICE)
        if (police) {
            if (police.game.target) {
                if (police.game.target.game.job === JobType.MAFIA)
                    police.send(Serialize.SystemMessage('<color=red>' + police.game.target.name + '님은 마피아입니다.</color>'))
                else
                    police.send(Serialize.SystemMessage(police.game.target.name + '님은 마피아가 아닙니다.'))
            }
        }
        const doctor = this.onlyLivingUser().filter(user => user.game.job === JobType.MAFIA)
        if (doctor) {
            if (target === doctor.game.target) {
                this.room.publish(Serialize.SystemMessage('화타에 의해 ' + target.name + '님이 기적적으로 살아났습니다!'))
                target = null
            }
        }
        if (target)
            this.room.publish(Serialize.SystemMessage('<color=red>마피아에 의해 ' + target.name + '님이 사망했습니다...</color>'))
        this.day()
    }

    result(winner) {
        this.state = STATE_RESULT
        const slice = this.room.users.slice(0)
        for (const user of slice) {
            user.roomId = 0
            user.game.result = true
        }
        Room.remove(this.room)
        for (const red of this.mafiaTeam)
            red.score.sum += 100
        for (const blue of this.citizenTeam)
            blue.score.sum += 100
        const ranks = slice.sort((a, b) => b.score.sum - a.score.sum)
        const persons = slice.length
        for (const red of this.mafiaTeam) {
            const mission = "킬 " + red.score.kill + "\n장농 킬 " + red.score.killForWardrobe
            let exp = 100 + red.score.sum
            let coin = 50 + parseInt(red.score.sum / 2)
            if (exp < 100)
                exp = 100
            if (coin < 50)
                coin = 50
            const rank = ranks.indexOf(red) + 1
            red.reward.exp = exp
            red.reward.coin = coin
            switch (rank) {
                case 1:
                    red.reward.point = 10
                    break
                case 2:
                    red.reward.point = 5
                    break
                case 3:
                    red.reward.point = 1
                    break
            }
            red.send(Serialize.ResultGame(winner, rank, persons, mission, exp, coin))
        }
        for (const blue of this.citizenTeam) {
            const mission = "구출 " + blue.score.rescue + " (" + blue.score.rescueCombo + "콤보)\n수감 " + (blue.score.death + blue.score.deathForWardrobe)
            let exp = 100 + blue.score.sum
            let coin = 50 + parseInt(blue.score.sum / 2)
            if (exp < 100)
                exp = 100
            if (coin < 50)
                coin = 50
            const rank = ranks.indexOf(blue) + 1
            blue.reward.exp = exp
            blue.reward.coin = coin
            switch (rank) {
                case 1:
                    blue.reward.point = 10
                    break
                case 2:
                    blue.reward.point = 5
                    break
                case 3:
                    blue.reward.point = 1
                    break
            }
            blue.send(Serialize.ResultGame(winner, rank, persons, mission, exp, coin))
        }
    }

    update() {
        if (++this.tick % 10 === 0) {
            this.tick = 0
            switch (this.state) {
                case STATE_READY:
                    this.room.publish(Serialize.NoticeMessage(this.count))
                    if (this.count === 0)
                        this.ready()
                    break
                case STATE_DAY:
                    if (this.count === 0)
                        this.checkDay()
                    break
                case STATE_NIGHT:
                    if (this.count === 0)
                        this.checkNight()
                    break
                case STATE_SUSPECT:
                    if (this.count === 0)
                        this.suspect()
                    break
                case STATE_LAST_DITCH:
                    if (this.count === 0)
                        this.vote()
                    break
                case STATE_DEATH_PENALTY:
                    if (this.count === 0)
                        this.night()
                    break
            }
            --this.count

            console.log("count: " + this.count)
        }
    }
}
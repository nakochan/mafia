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
        this.count = 5
        this.maxCount = 5
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
            vote: null,
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
        const { events } = room.places[2]
        const event = events.filter(e => e.owner === self.index)
        if (event)
            this.room.removeEvent(event)
        // self.publish(Serialize.UpdateModeCount(this.score.red))
    }

    moveToDay(self) {
        self.teleport(1, 24, 14)
        self.send(Serialize.SwitchLight(false))
        self.send(Serialize.NoticeMessage(this.days + '째날 아침이 밝았습니다...'))
        self.send(Serialize.PlaySound(1, 'hospital'))
    }

    moveToNight(self) {
        if (self.game.dead || self.game.job === JobType.MAFIA || self.game.job === JobType.POLICE || self.game.job === JobType.DOCTOR) {
            self.teleport(2, 24, 14)
            self.send(Serialize.PlaySound(1, 'c24'))
        } else {
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
            self.send(Serialize.PlaySound(1, 'n14'))
        }
        self.send(Serialize.SwitchLight(false))
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
        if (target.game.dead)
            return false
        return true
    }

    useItem(self) {
        return true
    }

    selectVote(self, index) {
        if (self.game.vote)
            return
        const findIndex = this.users.findIndex(user => user.index === index)
        if (findIndex < 0)
            return
        const user = this.users[findIndex]
        if (!user)
            return
        if (self.game.vote === user)
            return
        self.game.vote = user
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
        this.count = 180
        this.state = STATE_DAY
        ++this.days
        for (const user of this.room.users) {
            user.game.count = 0
            user.game.vote = null
            this.moveToDay(user)
        }
        this.room.publish(Serialize.PlaySound(2, 'GhostsTen'))
    }

    checkDay() {
        if (this.days <= 1)
            return this.night()
        this.count = 10
        this.state = STATE_SUSPECT
        this.room.publish(Serialize.GetVote(this.onlyLivingUser()))
    }

    suspect() {
        this.room.publish(Serialize.CloseVote())
        const targets = this.onlyLivingUser().slice(0).sort((a, b) => b.game.count - a.game.count)
        const target = targets[0]
        if (target.game.count < 1)
            return this.night()
        const checkSameVotes = targets.filter(user => user.game.count === target.game.count)
        if (checkSameVotes.length > 1)
            return this.night()
        this.target = target
        this.lastDitch()
    }

    lastDitch() {
        this.count = 10
        this.state = STATE_DEATH_PENALTY
        for (const user of this.room.users) {
            if (this.target === user)
                self.teleport(13, 10, 7)
            else
                self.teleport(13, 10, 13)
        }
    }

    vote() {
        this.count = 10
        this.state = STATE_VOTE
        if (this.target === null)
            return this.night()
        let dieCount = this.onlyLivingUser().filter(user => user.x >= 10).length
        let saveCount = this.onlyLivingUser().length - dieCount
        if (dieCount > saveCount) {
            this.target.game.dead = true
            this.target.setGraphics(this.target.deadGraphics)
        }
        this.target = null
        this.deathPenalty()
    }

    deathPenalty() {
        this.night()
    }

    night() {
        this.count = 60
        this.state = STATE_NIGHT
        for (const user of this.room.users)
            this.moveToNight(user)
    }

    checkNight() {
        this.day()
    }

    result(winner) {
        this.state = STATE_RESULT

    }

    update() {
        if (++this.tick % 10 === 0) {
            this.tick = 0
            switch (this.state) {
                case STATE_READY:
                    if (this.count === 10)
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

                    break
            }
            --this.count
        }
    }
}
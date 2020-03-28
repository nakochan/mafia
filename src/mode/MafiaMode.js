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
        this.userUniqueIndex = 0
        this.tick = 0
        this.count = 10
        this.maxCount = 10
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
            mode: this.type,
            count: this.count,
            maxCount: this.maxCount,
            persons: this.citizenTeam.length
        }
    }

    gameObject() {
        return {
            index: 0,
            team: TeamType.DEFAULT,
            job: JobType.DEFAULT,
            count: 0,
            dead: false,
            result: false
        }
    }

    join(self) {
        self.game = this.gameObject()
        self.game.index = ++this.userUniqueIndex
        self.game.team = TeamType.CITIZEN
        self.setGraphics(self.pureGraphics)
        this.citizenTeam.push(self)
        this.moveToDay(self)
        self.send(Serialize.NoticeMessage('감옥에 갇힌 인질을 전원 구출하라.'))
        self.publishToMap(Serialize.SetGameTeam(self))
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
        // self.publish(Serialize.UpdateModeCount(this.score.red))
    }

    moveToDay(self) {
        self.teleport(1, 24, 14)
        self.send(Serialize.PlaySound(1, 'hospital'))
    }

    moveToNight(self) {
        self.teleport(2, 24, 14)
        self.send(Serialize.PlaySound(1, 'n14'))
    }

    moveToHouse(self) {
        self.teleport(42, 9, 7)
        self.send(Serialize.PlaySound(1, 'n14'))
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

        return true
    }

    useItem(self) {
        return true
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
        this.room.publish(Serialize.PlaySound(2, 'GhostsTen'))
        this.init()
        for (const user of this.room.users) {
            if (this.jobs.length > 0) {
                const job = pix.sample(this.jobs, 1)
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
            console.log(user.game.job + " / " + user.name)
            this.moveToDay(user)
        }
        this.day()
    }

    day() {
        this.count = 180
        this.state = STATE_DAY
        for (const user of this.onlyLivingUser())
            user.game.count = 0
        ++this.days
        // n번째 날이 밝았습니다.
        console.log(this.days + "날 밝음")
        if (this.days >= 2)
            this.check()
    }

    suspect() {
        this.count = 10
        const targets = this.onlyLivingUser().slice(0).sort((a, b) => b.game.count - a.game.count)
        const target = targets[0]
        if (target.game.count < 1)
            return this.night()
        const checkSameVotes = targets.filter(user => user.game.count === target.game.count)
        if (checkSameVotes.length > 1)
            return this.night()
        this.target = target
        this.deathPenalty()
    }

    deathPenalty() {
        this.count = 10
        this.state = STATE_DEATH_PENALTY
    }

    vote() {
        this.count = 10
        this.state = STATE_VOTE
        if (this.target === null)
            return this.night()
        let dieCount = this.onlyLivingUser().filter(user => user.x > 10).length
        let saveCount = this.onlyLivingUser().length - dieCount
        if (dieCount > saveCount) {
            this.target.game.dead = true
            this.target.setGraphics(this.target.deadGraphics)
        }
        this.night()
    }

    night() {
        this.count = 180
        this.state = STATE_NIGHT
        for (const user of this.room.users)
            this.moveToNight(user)
    }

    check() {
        this.count = 10
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
                    break
                case STATE_NIGHT:
                    break
                case STATE_SUSPECT:
                    break
                case STATE_LAST_DITCH:
                    break
                case STATE_VOTE:
                    break
                case STATE_DEATH_PENALTY:
                    break
            }
            --this.count
        }
    }
}
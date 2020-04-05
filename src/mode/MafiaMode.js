const Serialize = require('../protocol/Serialize')
const GameMap = require('../GameMap')
const { TeamType, JobType, MapType, ModeType } = require('../util/const')
const PlayerState = require('../PlayerState')
const Event = require('../Event')
const pix = require('../util/pix')
const config = require('../config')

const STATE_READY = 0
const STATE_DAY = 1
const STATE_NIGHT = 2
const STATE_SUSPECT = 3
const STATE_LAST_DITCH = 4
const STATE_VOTE = 5
const STATE_DEATH_PENALTY = 6
const STATE_RESULT = 7

module.exports = class MafiaMode {
    constructor(roomId) {
        this.roomId = roomId
        this.state = STATE_READY
        this.map = MapType.TOWN
        this.mode = ModeType.MAFIA
        this.tick = 0
        this.count = 30
        this.maxCount = 30
        this.days = 0
        this.mafiaTeam = []
        this.citizenTeam = []
        this.jobs = []
        this.subJobs = []
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
            days: 0,
            life: 0,
            count: 0,
            vote: null,
            target: null,
            cling: null,
            suspect: null,
            time: false,
            touch: false,
            threat: false,
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
                const SIGN_X = [16, 26, 32, 36, 39, 30, 26, 18, 9, 12]
                const SIGN_Y = [10, 9, 10, 19, 30, 32, 35, 32, 30, 19]
                const sign = new Event(this.roomId, {
                    "name": self.pick + ". " + self.name + "의 집",
                    "place": 2,
                    "x": SIGN_X[self.pick - 1],
                    "y": SIGN_Y[self.pick - 1],
                    "graphics": "Sign",
                    "owner": self.index,
                    "collider": true,
                    "action": {
                        "command": ""
                    }
                })
                this.room.addEvent(sign)
                this.room.publish(Serialize.CreateGameObject(sign))
                const OTHER_SELF_MAP = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                const OTHER_SELF_X = [7, 7, 15, 7, 7, 7, 7, 7, 7, 7]
                const OTHER_SELF_Y = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]
                const otherSelf = new Event(this.roomId, {
                    "name": self.pick + ". " + self.name,
                    "place": OTHER_SELF_MAP[self.pick - 1],
                    "x": OTHER_SELF_X[self.pick - 1],
                    "y": OTHER_SELF_Y[self.pick - 1],
                    "graphics": self.pureGraphics,
                    "owner": self.index,
                    "collider": true,
                    "action": {
                        "command": ""
                    }
                })
                this.room.addEvent(otherSelf)
                this.room.publish(Serialize.CreateGameObject(otherSelf))
                break
            default:
                self.game.dead = true
                self.setGraphics(self.deadGraphics)
                break
        }
        this.moveToDay(self)
        self.publishToMap(Serialize.SetGameTeam(self))
        self.send(Serialize.UpdateModeInfo(self.game.job, this))
        self.send(Serialize.ModeData(this))
        self.send(Serialize.ToggleHit(false))
        self.send(Serialize.ToggleTime(false))
        this.room.broadcast(self, Serialize.SetUpUserJobMemo(self))
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
        if (this.state !== STATE_READY && this.mafiaTeam.length < 1)
            this.result(TeamType.CITIZEN)
        self.game = {}
        self.setGraphics(self.pureGraphics)
        this.removeSignAndOtherSelf(self)
        this.room.publish(Serialize.RemoveUserJobMemo(self.pick))
    }

    removeSignAndOtherSelf(self) {
        for (let i = 1; i <= config.MAP_COUNT; i++) {
            const { events } = this.room.places[i]
            const event = events.filter(e => e.owner === self.index)
            if (event)
                this.room.removeEvent(event)
        }
    }

    moveToDay(self) {
        self.send(Serialize.SwitchLight(false))
        self.send(Serialize.ToggleTime(true))
        if (self.game.dead)
            self.teleport(1, 24, 24)
        else {
            const X = [20, 24, 28, 28, 28, 28, 24, 20, 20, 20]
            const Y = [14, 14, 14, 16, 18, 20, 20, 20, 18, 16]
            self.teleport(1, X[self.pick - 1], Y[self.pick - 1])
        }
        self.send(Serialize.PlaySound(1, 'hospital'))
        self.send(Serialize.UpdateModeInfo(self.game.job, this))
    }

    moveToNight(self) {
        if (self.game.dead) {
            self.teleport(2, 24, 14)
            self.send(Serialize.PlaySound(1, 'c24'))
        } else {
            if (self.game.job === JobType.CITIZEN
                || self.game.job === JobType.ARMY
                || self.game.job === JobType.LAWYER
                || self.game.job === JobType.THIEF
                || self.game.job === JobType.TERRORIST
                || (self.game.job === JobType.SHAMAN && self.game.life < 1)) {
                self.setGraphics(this.pureGraphics)
                switch (self.pick) {
                    case 1:
                        self.teleport(3, 7, 6, 0, -1)
                        break
                    case 2:
                        self.teleport(4, 7, 6, 0, -1)
                        break
                    case 3:
                        self.teleport(5, 15, 6, 0, -1)
                        break
                    case 4:
                        self.teleport(6, 7, 6, 0, -1)
                        break
                    case 5:
                        self.teleport(7, 7, 6, 0, -1)
                        break
                    case 6:
                        self.teleport(8, 7, 6, 0, -1)
                        break
                    case 7:
                        self.teleport(9, 7, 6, 0, -1)
                        break
                    case 8:
                        self.teleport(10, 7, 6, 0, -1)
                        break
                    case 9:
                        self.teleport(11, 7, 6, 0, -1)
                        break
                    case 10:
                        self.teleport(12, 7, 6, 0, -1)
                        break
                }
                self.send(Serialize.PlaySound(1, 'c24'))
            } else {
                switch (self.game.job) {
                    case JobType.MAFIA:
                        self.send(Serialize.SystemMessage('죽일 사람의 집에 찾아가 공격 버튼을 클릭하세요...', 'red'))
                        break
                    case JobType.POLICE:
                        self.send(Serialize.SystemMessage('마피아인지 조사할 사람의 집에 찾아가 공격 버튼을 클릭하세요...', 'red'))
                        break
                    case JobType.DOCTOR:
                        self.send(Serialize.SystemMessage('살릴 사람의 집에 찾아가 공격 버튼을 클릭하세요...', 'red'))
                        break
                    case JobType.SPIRIT:
                        self.send(Serialize.SystemMessage('원하는 사람에게 찾아가 공격 버튼을 클릭하여 직업을 알아보세요...', 'red'))
                        break
                    case JobType.SPY:
                        self.send(Serialize.SystemMessage('마피아를 찾아 접선을 시도하고 마피아팀과 합류하세요...', 'red'))
                        break
                }
                self.game.target = null
                self.setGraphics('Shadow')
                self.teleport(2, 24, 14)
                self.send(Serialize.PlaySound(1, 'n14'))
                self.send(Serialize.ToggleHit(true))
            }
        }
        self.send(Serialize.SwitchLight(true))
        self.send(Serialize.NoticeMessage('밤이 되었습니다.'))
        self.send(Serialize.UpdateModeInfo(self.game.job, this))
    }

    drawEvents(self) {
        const { events } = this.room.places[self.place]
        for (const event of events) {
            let hide = false
            switch (this.state) {
                case STATE_NIGHT:
                    if (self.game.job === JobType.CITIZEN
                        || self.game.job === JobType.ARMY
                        || self.game.job === JobType.LAWYER
                        || self.game.job === JobType.THIEF
                        || self.game.job === JobType.TERRORIST
                        || (self.game.job === JobType.SHAMAN && self.game.life < 1))
                        hide = true
                    break
                default:
                    break
            }
            if (!hide)
                self.send(Serialize.CreateGameObject(event))
        }
    }

    drawUsers(self) {
        let selfHide = false
        let selfNameHide = false
        const sameMapUsers = this.room.sameMapUsers(self.place)
        for (const user of sameMapUsers) {
            if (self === user)
                continue
            let userHide = false
            let userNameHide = false
            switch (this.state) {
                case STATE_NIGHT:
                    selfHide = userHide = true
                    selfNameHide = userNameHide = true
                    if ((self.game.job === JobType.MAFIA
                        || self.game.job === JobType.SPY
                        || self.game.job === JobType.POLICE
                        || self.game.job === JobType.DOCTOR
                        || self.game.job === JobType.SPIRIT
                        || self.game.job === JobType.GANGSTER)
                        && (user.game.job === JobType.CITIZEN
                            || user.game.job === JobType.ARMY
                            || user.game.job === JobType.LAWYER
                            || user.game.job === JobType.THIEF
                            || user.game.job === JobType.TERRORIST
                            || (user.game.job === JobType.SHAMAN && user.game.life < 1)))
                        selfHide = false
                    if (self.game.job === JobType.SPY && user.game.job === JobType.ARMY)
                        selfNameHide = false
                    if (self.game.dead && !user.game.dead)
                        selfHide = true
                    if (user.game.dead && !self.game.dead)
                        userHide = true
                    break
                case STATE_LAST_DITCH:
                    selfNameHide = userNameHide = true
                    if (self === this.target)
                        selfNameHide = false
                    if (user === this.target)
                        userNameHide = false
                    if (self.game.dead && !user.game.dead)
                        selfHide = true
                    if (user.game.dead && !self.game.dead)
                        userHide = true
                    break
                default:
                    if (self.game.dead && !user.game.dead)
                        selfHide = true
                    if (user.game.dead && !self.game.dead)
                        userHide = true
                    break
            }
            if (!userHide)
                self.send(Serialize.CreateGameObject(user, userNameHide))
            if (!selfHide)
                user.send(Serialize.CreateGameObject(self, selfNameHide))
        }
    }

    gameChat(self, message) {
        if (self.game.dead)
            this.broadcastToDead(Serialize.ChatMessage(self.type, self.index, `[관전] ${self.pick}. ${self.name}`, message, '#808080'))
        else {
            switch (this.state) {
                case STATE_NIGHT:
                    if (self.game.job === JobType.MAFIA || (self.game.job === JobType.SPY && self.game.touch) || (self.game.job === JobType.BITCH && self.game.touch))
                        this.broadcastToMafia(Serialize.ChatMessage(self.type, self.index, `${self.pick}. ${self.name}`, message, '#C90000'))
                    else if (self.game.job === JobType.SPIRIT)
                        this.broadcastToDead(Serialize.ChatMessage(self.type, self.index, `[영매] ${self.pick}. ${self.name}`, message, '#47C83E'))
                    else
                        self.send(Serialize.SystemMessage('밤에 대화할 수 없습니다.', 'red'))
                    break
                case STATE_LAST_DITCH:
                    if (self !== this.target) {
                        self.send(Serialize.SystemMessage('최후의 변론자만 대화할 수 있습니다.', 'red'))
                        break
                    }
                case STATE_DEATH_PENALTY:
                    if (self !== this.target) {
                        self.send(Serialize.SystemMessage('최후의 변론자만 대화할 수 있습니다.', 'red'))
                        break
                    }
                default:
                    this.room.publish(Serialize.ChatMessage(self.type, self.index, `${self.pick}. ${self.name}`, message, '#99D9EA'))
                    break
            }
        }
    }

    hit(self, target) {
        return true
    }

    useItem(self) {
        return true
    }

    setTarget(self) {
        if (self.place < 3 || self.place > 12)
            return
        const findIndex = this.room.users.findIndex(user => user.pick === self.place - 2)
        if (findIndex < 0)
            return
        const target = this.room.users[findIndex]
        if (!target)
            return
        if (self.game.target || self.game.dead)
            return
        if (self.game.job === JobType.SPIRIT && !target.game.dead)
            return self.send(Serialize.NoticeMessage('산 사람을 대상으로 설정할 수 없습니다.'))
        if (self.game.job !== JobType.SPIRIT && target.game.dead)
            return self.send(Serialize.NoticeMessage('죽은 사람을 대상으로 설정할 수 없습니다.'))
        if (self.game.job === JobType.SHAMAN && target.game.dead)
            return self.send(Serialize.NoticeMessage('죽은 사람을 대상으로 설정할 수 없습니다.'))
        if (self.game.job === JobType.SHAMAN && self.game.life < 1)
            return
        if (self.game.job === JobType.DEFAULT || self.game.job === JobType.CITIZEN)
            return
        if ((self.game.job === JobType.MAFIA || self.game.job === JobType.POLICE || self.game.job === JobType.SPIRIT || self.game.job === JobType.GANGSTER) && self === target)
            return self.send(Serialize.NoticeMessage('자기 자신은 지정할 수 없습니다.'))
        if (self.game.job === JobType.DOCTOR && this.days >= 2 && self === target)
            return self.send(Serialize.NoticeMessage('두 번째 날부터는 자기 자신을 치료할 수 없습니다.'))
        if (self.game.job === JobType.MAFIA && target.game.job === JobType.MAFIA)
            return self.send(Serialize.NoticeMessage('같은 마피아 직업은 살해할 수 없습니다.'))
        const jobName = ["", "마피아", "시민", "경찰", "의사", "간첩", "군인", "변호사", "조폭", "무당", "매춘부", "연인", "탐정", "테러리스트", "도둑", "살인마", "영매", "버스기사"]
        self.game.target = target
        self.send(Serialize.NoticeMessage(target.pick + '. ' + target.name + '님을 대상으로 지정했습니다.'))
        if (self.game.job === JobType.MAFIA) {
            target.game.suspect = self
            this.room.publish(Serialize.PlaySound(2, 'Gun'))
        }
        if (self.game.job === JobType.POLICE) {
            if (target.game.job === JobType.MAFIA)
                self.send(Serialize.SystemMessage(target.name + '님은 마피아입니다.', 'red'))
            else
                self.send(Serialize.SystemMessage(target.name + '님은 마피아가 아닙니다.', 'red'))
        }
        if (self.game.job === JobType.DOCTOR)
            this.room.publish(Serialize.PlaySound(2, 'magical21'))
        if (self.game.job === JobType.SPIRIT) {
            if (this.days <= 1)
                return self.send(Serialize.SystemMessage('두번째 날부터 직업을 알아낼 수 있습니다.', 'red'))
            self.send(Serialize.SystemMessage(target.name + '님의 직업은 ' + jobName[target.game.job] + '입니다.', 'red'))
        }
        if (self.game.job === JobType.SHAMAN) {
            self.game.days = this.days + 1
            self.game.life = 0
            self.game.cling = target
            self.send(Serialize.SystemMessage('살을 날렸으므로, 3일 후 마피아인지 아닌지 결과가 나오게 됩니다.', 'red'))
        }
        if (self.game.job === JobType.GANGSTER)
            target.game.threat = true
        if (self.game.job === JobType.SPY) {
            if (self.game.touch) {
                self.send(Serialize.SystemMessage(target.name + '님의 직업은 ' + jobName[target.game.job] + '입니다.', 'red'))
            } else {
                if (target.game.job === JobType.MAFIA) {
                    self.game.touch = true
                    self.send(Serialize.SystemMessage('마피아와 밤에 채팅이 가능하며 다음 밤부터 직업 조사가 가능합니다.', 'red'))
                    this.broadcastToMafia(Serialize.SystemMessage(`${self.name}님께서 접선에 성공했습니다.`, 'red'))
                } else
                    self.send(Serialize.SystemMessage('마피아가 아닙니다...', 'red'))
            }
        }
    }

    setGameTime(self, active) {
        if (self.game.dead)
            return
        if (this.state !== STATE_DAY)
            return self.send(Serialize.SystemMessage('낮에만 사용할 수 있습니다.', 'red'))
        if (!self.game.time)
            return self.send(Serialize.SystemMessage('오늘은 이미 사용했습니다. 날이 지난 후 다시 사용하세요.', 'red'))
        if (active) {
            this.count += 15
            self.game.time = false
            this.room.publish(Serialize.SystemMessage(`${self.name}님이 시간 연장을 사용했습니다.`, 'red'))
        } else {
            this.count -= 15
            self.game.time = false
            this.room.publish(Serialize.SystemMessage(`${self.name}님이 시간 단축을 사용했습니다.`, 'red'))
        }
        this.room.publish(Serialize.PlaySound(2, 'system10'))
        this.room.publish(Serialize.ModeData(this))
    }

    selectVote(self, index) {
        if (self.game.dead || self.game.vote)
            return
        const findIndex = this.room.users.findIndex(user => user.index === index)
        if (findIndex < 0)
            return
        const user = this.room.users[findIndex]
        if (!user)
            return
        if (self.game.vote === user)
            return
        self.game.vote = user
        user.game.count += self.game.job === JobType.LAWYER ? 2 : 1
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
        if (this.room.users.length >= 6)
            this.jobs.push(JobType.SPY)
        if (this.room.users.length >= 8)
            this.jobs.push(JobType.MAFIA)
        this.subJobs = [
            JobType.ARMY,
            JobType.LAWYER,
            JobType.THIEF,
            JobType.SPIRIT,
            JobType.GANGSTER,
            JobType.SHAMAN,
            JobType.TERRORIST
        ]
        // this.supply()
    }

    ready() {
        this.init()
        const slice = this.room.users.slice(0)
        const users = slice.sort(() => 0.5 - Math.random())
        for (const user of users) {
            if (this.jobs.length > 0) {
                const rand = Math.floor(Math.random() * this.jobs.length)
                const job = this.jobs[rand]
                this.jobs.splice(this.jobs.indexOf(job), 1)
                if (job === JobType.MAFIA || job === JobType.SPY) {
                    this.citizenTeam.splice(this.citizenTeam.indexOf(user), 1)
                    this.mafiaTeam.push(user)
                    user.game.team = TeamType.MAFIA
                }
                user.game.job = job
            } else if (this.subJobs.length > 0) {
                const rand = Math.floor(Math.random() * this.subJobs.length)
                const subJobs = this.subJobs[rand]
                this.subJobs.splice(this.subJobs.indexOf(subJobs), 1)
                user.game.job = subJobs
                if (subJobs === JobType.ARMY || subJobs === JobType.SHAMAN)
                    user.game.life = 1
            } else
                user.game.job = JobType.CITIZEN
            user.send(Serialize.SetGameTeam(user))
            user.send(Serialize.UpdateModeInfo(user.game.job, this))
        }
        this.night()
    }

    day() {
        this.count = 90
        this.state = STATE_DAY
        ++this.days
        for (const user of this.room.users) {
            user.game.count = 0
            user.game.vote = null
            user.game.time = true
            if (!user.game.dead)
                user.setGraphics(user.pureGraphics)
            user.send(Serialize.NoticeMessage(this.days + '째날 아침이 밝았습니다...'))
            this.moveToDay(user)
        }
        // this.room.publish(Serialize.PlaySound(2, 'GhostsTen'))
        this.room.publish(Serialize.ModeData(this))
    }

    checkDay() {
        this.count = 10
        this.state = STATE_SUSPECT
        for (const user of this.room.users) {
            if (user.game.threat)
                user.send(Serialize.SystemMessage('조폭에게 협박을 당해 낮에 투표할 수 없습니다!!!', 'red'))
            else
                user.send(Serialize.GetVote(this.onlyLivingUser()))
        }
        this.room.publish(Serialize.ToggleTime(false))
        this.room.publish(Serialize.ModeData(this))
        this.room.publish(Serialize.PlaySound(1, 'kyuutai'))
    }

    suspect() {
        for (const user of this.room.users)
            user.send(Serialize.CloseVote())
        const targets = this.onlyLivingUser().slice(0).sort((a, b) => b.game.count - a.game.count)
        if (targets.length < 1)
            return this.night()
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
        this.state = STATE_LAST_DITCH
        for (const user of this.room.users) {
            if (user.game.threat)
                user.game.threat = false
            if (this.target === user)
                user.teleport(13, 10, 5)
            else {
                if (!user.game.dead)
                    user.setGraphics('Shadow')
                user.teleport(13, 10, 12)
            }
        }
        this.room.publish(Serialize.SystemMessage('죽인다 O, 살린다 X 로 이동하세요.', 'red'))
        this.room.publish(Serialize.ModeData(this))
    }

    vote() {
        this.state = STATE_VOTE
        if (this.target === null)
            return this.night()
        const saveCount = this.onlyLivingUser().filter(user => user.x > 10).length
        const dieCount = this.onlyLivingUser().filter(user => user.x < 10).length
        if (saveCount < dieCount) {
            if (this.target.game.job === JobType.MAFIA)
                this.room.publish(Serialize.SystemMessage('마피아를 찾아냈습니다!!!', 'red'))
            else if (this.target.game.job === JobType.LAWYER) {
                this.room.publish(Serialize.SystemMessage('변호사를 사형 집행을 할 수 없습니다.', 'red'))
                return this.deathPenalty()
            } else if (this.target.game.job === JobType.TERRORIST) {
                this.room.publish(Serialize.SystemMessage('그는 테러리스트였다...! 으아악. 모두 피해!!!', 'red'))
                this.room.publish(Serialize.PlaySound(2, 'Explode'))
                const terror = this.target.game.vote
                if (terror) {
                    if (terror !== this.target) {
                        terror.game.dead = true
                        terror.setGraphics(terror.deadGraphics)
                        this.room.publish(Serialize.SystemMessage(`테러리스트에 의해 ${terror.name}님도 같이 사망했습니다...`, 'red'))
                        this.room.publish(Serialize.SetUpUserJobMemo(terror))
                        this.room.publish(Serialize.PlaySound(2, 'scream1'))
                        this.removeSignAndOtherSelf(terror)
                    }
                }
            } else
                this.room.publish(Serialize.SystemMessage('선량한 시민이 죽었습니다...', 'red'))
            this.target.game.dead = true
            this.target.setGraphics(this.target.deadGraphics)
            this.room.publish(Serialize.SetUpUserJobMemo(this.target))
            this.room.publish(Serialize.PlaySound(2, 'strangulation'))
            this.removeSignAndOtherSelf(this.target)
        } else
            this.room.publish(Serialize.SystemMessage('과반수의 반대로 사형을 집행하지 않습니다.', 'red'))
        this.deathPenalty()
    }

    deathPenalty() {
        this.count = 2
        this.state = STATE_DEATH_PENALTY
        const mafiaPersons = this.onlyLivingUser().filter(user => user.game.job === JobType.MAFIA).length
        if (mafiaPersons < 1)
            return this.result(TeamType.CITIZEN)
        const mafiaTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.MAFIA).length
        const citizenTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.CITIZEN).length
        const lawyerPersons = this.onlyLivingUser().filter(user => user.game.job === JobType.LAWYER).length
        if (mafiaTeam >= citizenTeam + lawyerPersons)
            return this.result(TeamType.MAFIA)
        else if (mafiaTeam < lawyerPersons + 1)
            return this.result(TeamType.CITIZEN)
    }

    night() {
        this.count = 30
        this.state = STATE_NIGHT
        for (const user of this.room.users)
            this.moveToNight(user)
        this.room.publish(Serialize.ModeData(this))
    }

    checkNight() {
        let target = null
        const mafias = this.onlyLivingUser().filter(user => user.game.job === JobType.MAFIA && user.game.target)
        if (mafias.length > 0) {
            const rand = Math.floor(Math.random() * mafias.length)
            const mafia = mafias[rand]
            if (mafia) {
                if (mafia.game.target) {
                    target = mafia.game.target
                    if (target.game.job === JobType.ARMY && target.game.life > 0) {
                        mafia.send(Serialize.SystemMessage('앗!! 이런 젠장... 방탄복 때문에 군인을 죽일 수 없었다.', 'red'))
                        target.send(Serialize.SystemMessage('방탄복 덕분에 마피아의 총격으로부터 보호를 받았다!!', 'red'))
                        target.game.life = 0
                        target = null
                    }
                }
            }
        }
        const doctors = this.onlyLivingUser().filter(user => user.game.job === JobType.DOCTOR)
        if (doctors.length > 0) {
            const doctor = doctors[0]
            if (doctor) {
                if (doctor.game.target) {
                    if (target === doctor.game.target) {
                        if (doctor === target)
                            this.room.publish(Serialize.SystemMessage('의사는 죽음을 매우 두려워 했습니다...', '#BCE55C'))
                        else
                            this.room.publish(Serialize.SystemMessage('현명한 의사 덕에 ' + target.name + '님이 기적적으로 살아났습니다!', '#BCE55C'))
                        target = null
                    }
                }
            }
        }
        const thiefs = this.onlyLivingUser().filter(user => user.game.job === JobType.THIEF)
        if (thiefs.length > 0) {
            const thief = thiefs[0]
            if (thief) {
                if (target) {
                    thief.game.job = target.game.job
                    if (thief.game.job === JobType.ARMY || thief.game.job === JobType.SHAMAN)
                        thief.game.life = 1
                } else {
                    thief.game.job = JobType.CITIZEN
                }
                thief.send(Serialize.SetGameTeam(thief))
                thief.send(Serialize.SystemMessage('직업이 변했습니다!', 'red'))
            }
        }
        if (target) {
            target.game.dead = true
            target.setGraphics(target.deadGraphics)
            this.removeSignAndOtherSelf(target)
            this.room.publish(Serialize.SystemMessage('마피아에 의해 ' + target.name + '님이 사망했습니다...', 'red'))
            this.room.publish(Serialize.SetUpUserJobMemo(target))
            this.room.publish(Serialize.PlaySound(2, 'Scream'))
            const shamans = this.onlyLivingUser().filter(user => user.game.job === JobType.SHAMAN)
            if (shamans.length > 0) {
                const shaman = shamans[0]
                if (shaman) {
                    if (shaman.game.cling && shaman.game.days >= this.days + 3) {
                        if (shaman.game.cling.game.suspect)
                            shaman.send(Serialize.SystemMessage(shaman.game.cling.name + '님을 죽인 마피아는 ' + shaman.game.cling.game.suspect.name + '입니다.', 'red'))
                    }
                }
            }
        } else {
            this.room.publish(Serialize.SystemMessage('지난 밤에는 아무도 죽지 않았습니다.', '#BCE55C'))
        }
        this.room.publish(Serialize.ToggleHit(false))
        const mafiaPersons = this.onlyLivingUser().filter(user => user.game.job === JobType.MAFIA).length
        if (mafiaPersons < 1)
            return this.result(TeamType.CITIZEN)
        const mafiaTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.MAFIA).length
        const citizenTeam = this.onlyLivingUser().filter(user => user.game.team === TeamType.CITIZEN).length
        const lawyerPersons = this.onlyLivingUser().filter(user => user.game.job === JobType.LAWYER).length
        if (mafiaTeam >= citizenTeam + lawyerPersons)
            return this.result(TeamType.MAFIA)
        else if (mafiaTeam < lawyerPersons + 1)
            return this.result(TeamType.CITIZEN)
        this.day()
    }

    supply() {
        const newObjects = require('../../Assets/Mods/Eve000.json')[3]
        for (const object of newObjects) {
            const event = new Event(this.roomId, object)
            event.place = 1
            event.x = 24
            event.y = 24
            this.room.addEvent(event)
            this.room.publishToMap(event.place, Serialize.CreateGameObject(event))
        }
    }

    result(winner) {
        this.state = STATE_RESULT
        const users = this.room.users.slice(0)
        for (const user of users) {
            user.roomId = 0
            user.game.result = true
        }
        Room.remove(this.room)
        for (const user of users) {
            user.score.sum += user.game.dead ? 100 : (this.days * 10)
            if (winner === user.game.team)
                user.score.sum += 100
        }
        // const ranks = users.sort((a, b) => b.score.sum - a.score.sum)
        for (const user of users) {
            let exp = 100 + user.score.sum
            let coin = 50 + parseInt(user.score.sum / 2)
            if (exp < 100)
                exp = 100
            if (coin < 50)
                coin = 50
            // const rank = ranks.indexOf(user) + 1
            user.reward.exp = exp
            user.reward.coin = coin
            user.send(Serialize.ResultGame(this.room.type, winner, users))
        }
    }

    broadcastToMafia(data) {
        for (const user of this.room.users) {
            if (user.game.job === JobType.MAFIA || (user.game.job === JobType.SPY && user.game.touch) || (user.game.job === JobType.BITCH && user.game.touch))
                user.send(data)
        }
    }

    broadcastToDead(data) {
        for (const user of this.room.users) {
            if (user.game.dead || user.game.job === JobType.SPIRIT)
                user.send(data)
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
                    if (this.count <= 0)
                        this.checkDay()
                    break
                case STATE_NIGHT:
                    if (this.count === 0)
                        this.checkNight()
                    break
                case STATE_SUSPECT:
                    if (this.count === 0) {
                        this.target = null
                        this.suspect()
                    }
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
        }
    }
}
import AppView from "../app-view/app-view"
import KanjiView from "../kanji-view/kanji-view"
import TouchController from "scripts/TouchController"
import StatusMessages from "../status-messages/status-messages"
import QuestionStatistics from "scripts/QuestionStatistics"
import Statistics from "scripts/Statistics"
import State from "scripts/State"
import copyToClipboard from "scripts/copyToClipboard"
import cloneTemplate from "scripts/cloneTemplate"
import levenshtein from "scripts/levenshtein"

const preventClicksTimeThreshold = 400

export default class MultipleChoiceTest extends HTMLElement {
	appView: AppView
	kanjiView: KanjiView
	englishView: HTMLElement
	comboView: HTMLElement
	comboCounter: HTMLElement
	triesView: HTMLElement
	triesCounter: HTMLElement
	accuracyView: HTMLElement
	accuracyValue: HTMLElement
	questionsInTest: string[]
	question: HTMLDivElement
	questionIndex: number
	questionStartTime: number
	answers: HTMLButtonElement[]
	touchController: TouchController
	statusMessages: StatusMessages
	returnButton: HTMLElement
	hudTimer: number
	hiddenHUDElements: Element[]

	constructor(questions: string[]) {
		super()
		this.questionsInTest = questions
	}

	connectedCallback() {
		this.statusMessages = document.getElementsByTagName("status-messages")[0] as StatusMessages

		this.initDOM()
		this.updateCombo()
		this.bindEventListeners()
		this.startTest()

		// Touch controller
		this.touchController = new TouchController()
		this.touchController.leftSwipe = () => this.tryNext()
	}

	disconnectedCallback() {
		this.touchController.unregister()
		document.removeEventListener("keydown", this.onKeyDown)
	}

	initDOM() {
		let template = cloneTemplate("multiple-choice-test-template")
		this.appendChild(template)

		this.question = this.getElementsByClassName("question")[0] as HTMLDivElement
		this.kanjiView = this.getElementsByTagName("kanji-view")[0] as KanjiView
		this.englishView = this.querySelector(".english")
		this.comboView = this.querySelector(".combo")
		this.comboCounter = this.querySelector(".combo-counter")
		this.triesView = this.querySelector(".tries")
		this.triesCounter = this.querySelector(".tries-counter")
		this.accuracyView = this.querySelector(".accuracy")
		this.accuracyValue = this.querySelector(".accuracy-value")
		this.returnButton = this.querySelector(".return")
		this.answers = [...this.getElementsByClassName("answer")] as HTMLButtonElement[]
		this.hiddenHUDElements = [...this.getElementsByClassName("hud-hidden")]
	}

	bindEventListeners() {
		for(let answer of this.answers) {
			answer.addEventListener("click", e => this.onAnswerClicked(e.target as HTMLButtonElement))
		}

		this.question.addEventListener("click", e => this.onQuestionClicked(e))
		this.returnButton.addEventListener("click", e => this.finishTest())

		document.addEventListener("keydown", e => this.onKeyDown(e))
	}

	onKeyDown(e: KeyboardEvent) {
		// 1-4: Answer buttons
		if(e.keyCode >= 49 && e.keyCode <= 52) {
			this.answers[e.keyCode - 49].click()
			e.stopPropagation()
			e.preventDefault()
			return
		}

		// Space or Return: Next button
		if(e.keyCode === 32 || e.keyCode === 13) {
			this.tryNext()
			e.stopPropagation()
			e.preventDefault()
			return
		}
	}

	startTest() {
		if(this.questionsInTest.length === 0) {
			console.error("No questions")
			return
		}

		this.questionIndex = -1
		this.nextQuestion()
	}

	onQuestionClicked(e: MouseEvent) {
		if(e.target === this.kanjiView.textElement) {
			copyToClipboard(this.kanjiView.kanji)
			this.statusMessages.post(`Copied ${this.kanjiView.kanji}`)
			return
		}

		if(!this.solved) {
			this.showHUD()
			return
		}

		this.nextQuestion()
	}

	showHUD() {
		for(let element of this.hiddenHUDElements) {
			element.classList.remove("hud-hidden")
		}

		clearTimeout(this.hudTimer)

		this.hudTimer = setTimeout(() => {
			for(let element of this.hiddenHUDElements) {
				element.classList.add("hud-hidden")
			}
		}, 1000)
	}

	tryNext() {
		if(!this.solved) {
			return
		}

		this.nextQuestion()
	}

	nextQuestion() {
		this.questionIndex++

		if(this.questionIndex >= this.questionsInTest.length) {
			this.finishTest()
			return
		}

		this.englishView.innerText = ""
		this.englishView.classList.add("fade-out")

		let nextKanji = this.questionsInTest[this.questionIndex]
		this.kanjiView.kanji = nextKanji
		this.clearAnswers()
		this.generateAnswers()
		this.updateKanjiStats()
		this.questionStartTime = Date.now()
	}

	updateKanjiStats() {
		let stats = State.user.statistics.questions.get(this.kanjiView.kanji)

		if(stats) {
			this.triesCounter.innerHTML = (stats.hits + stats.misses).toString()
			this.triesView.classList.remove("hidden")

			this.accuracyValue.innerHTML = (QuestionStatistics.accuracy(stats) * 100).toFixed(0) + "%"
			this.accuracyView.classList.remove("hidden")
		} else {
			this.accuracyValue.innerHTML = ""
			this.accuracyView.classList.add("hidden")

			this.triesCounter.innerHTML = ""
			this.triesView.classList.add("hidden")
		}
	}

	finishTest() {
		State.app.fade(() => State.app.navigate("/"))
	}

	clearAnswers() {
		for(let answer of this.answers) {
			answer.innerText = ""
			answer.classList.remove("correct")
			answer.classList.remove("wrong")
			answer.disabled = false
		}
	}

	get correctAnswer() {
		return State.words.get(this.kanjiView.kanji).hiragana
	}

	get solved() {
		return !!this.answers.find(answer => answer.classList.contains("correct"))
	}

	generateAnswers() {
		let wordPool = [...State.words.values()]
		let used = new Set<string>()
		let question = this.kanjiView.kanji
		let correctAnswer = this.correctAnswer

		// Sort by Levenshtein distance
		wordPool.sort((a, b) => levenshtein(correctAnswer, a.hiragana) - levenshtein(correctAnswer, b.hiragana))

		// Find kana at the end
		let i = question.length - 1

		for(; i >= 0; i--) {
			let charCode = question.charCodeAt(i)
			let isHiragana = charCode >= 0x3040 && charCode <= 0x309f
			let isKatakana = charCode >= 0x30a0 && charCode <= 0x30ff

			if(!isHiragana && !isKatakana) {
				break
			}
		}

		let kana = question.slice(i + 1)

		// If there are kana at the end,
		// only allow answers that end with the given kana.
		if(kana.length > 0) {
			let filteredWords = wordPool.filter(x => x.hiragana.endsWith(kana))

			// If the filtered version doesn't have enough options,
			// combine it with all the other vocab.
			if(filteredWords.length < this.answers.length) {
				filteredWords = filteredWords.concat(wordPool)
			}

			wordPool = filteredWords
		}

		// Add correct answer
		let correctAnswerIndex = Math.floor(Math.random() * this.answers.length)
		this.answers[correctAnswerIndex].innerText = correctAnswer
		used.add(correctAnswer)

		let count = 0

		for(let answer of this.answers) {
			// Skip existing answers
			if(answer.innerText !== "") {
				continue
			}

			if(count >= wordPool.length) {
				answer.innerText = "-"
				continue
			}

			let text = wordPool[count].hiragana
			count++

			// Avoid duplicate answers
			if(wordPool.length >= this.answers.length) {
				while(used.has(text) && count < wordPool.length) {
					text = wordPool[count].hiragana
					count++
				}
			}

			answer.innerText = text
			used.add(text)
		}
	}

	onAnswerClicked(answer: HTMLButtonElement) {
		if(answer.disabled) {
			return
		}

		// Prevent accidental clicks at the start of a question
		if(Date.now() - this.questionStartTime < preventClicksTimeThreshold) {
			return
		}

		// Show English translation
		this.englishView.innerText = State.words.get(this.kanjiView.kanji).english
		this.englishView.classList.remove("fade-out")

		let correctAnswer = this.correctAnswer

		if(answer.innerText === correctAnswer) {
			// If we clicked on the correctly highlighted answer,
			// simply go to the next question.
			if(answer.classList.contains("correct")) {
				this.nextQuestion()
				return
			}

			// Show correct answer in green
			answer.classList.add("correct")

			// Update statistics
			this.onCorrectAnswer()
		} else {
			// Show wrong answer in red
			answer.classList.add("wrong")

			// Find the correct answer to highlight it
			for(let element of this.answers) {
				if(element.innerText === correctAnswer) {
					element.classList.add("correct")
					break
				}
			}

			// Update statistics
			this.onWrongAnswer()
		}

		// Disable incorrect answer
		for(let element of this.answers) {
			if(element.innerText !== correctAnswer && !element.classList.contains("wrong")) {
				element.disabled = true
			}
		}
	}

	updateCombo() {
		let combo = State.user.statistics.comboHits

		if(combo === 0) {
			this.comboView.classList.add("hidden")
		} else {
			this.comboView.classList.remove("hidden")
		}

		this.comboCounter.innerHTML = combo.toString()
	}

	onCorrectAnswer() {
		let stats = State.user.statistics
		Statistics.hit(stats)
		this.updateCombo()

		let questionText = this.kanjiView.kanji

		if(!stats.questions.has(questionText)) {
			stats.questions.set(questionText, new QuestionStatistics())
		}

		let questionStats = stats.questions.get(questionText)
		questionStats.hits++
		questionStats.comboHits++
		questionStats.comboMisses = 0
		questionStats.lastSeen = Date.now()
		this.updateKanjiStats()

		// Save
		setTimeout(() => State.user.save(), 1)
	}

	onWrongAnswer() {
		let stats = State.user.statistics
		Statistics.miss(stats)
		this.updateCombo()

		let questionText = this.kanjiView.kanji

		if(!stats.questions.has(questionText)) {
			stats.questions.set(questionText, new QuestionStatistics())
		}

		let questionStats = stats.questions.get(questionText)
		questionStats.misses++
		questionStats.comboMisses++
		questionStats.comboHits = 0
		questionStats.lastSeen = Date.now()
		this.updateKanjiStats()

		// Save
		setTimeout(() => State.user.save(), 1)
	}
}
import AppView from "../app-view/app-view"
import KanjiView from "../kanji-view/kanji-view"
import TouchController from "scripts/TouchController"
import State from "scripts/State"
import randomItem from "scripts/randomItem"
import copyToClipboard from "scripts/copyToClipboard"
import cloneTemplate from "scripts/cloneTemplate"
import StatusMessages from "../status-messages/status-messages"

const preventClicksTimeThreshold = 400

export default class MultipleChoiceTest extends HTMLElement {
	appView: AppView
	kanjiView: KanjiView
	questionsInTest: string[]
	question: HTMLDivElement
	questionIndex: number
	questionStartTime: number
	answers: HTMLButtonElement[]
	touchController: TouchController
	statusMessages: StatusMessages

	constructor(questions: string[]) {
		super()
		this.questionsInTest = questions
	}

	async connectedCallback() {
		this.statusMessages = document.getElementsByTagName("status-messages")[0] as StatusMessages

		this.initDOM()
		this.bindEventListeners()
		this.startTest()

		// Touch controller
		this.touchController = new TouchController()
		this.touchController.leftSwipe = () => this.tryNext()

		requestAnimationFrame(() => this.classList.remove("fade-out"))
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
		this.answers = [...this.getElementsByClassName("answer")] as HTMLButtonElement[]
	}

	bindEventListeners() {
		for(let answer of this.answers) {
			answer.addEventListener("click", e => this.onAnswerClicked(e.target as HTMLButtonElement))
		}

		this.question.addEventListener("click", e => this.onQuestionClicked(e))

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
			return
		}

		this.nextQuestion()
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
			State.app.fade(() => this.onFinishTest())
			return
		}

		let nextKanji = this.questionsInTest[this.questionIndex]
		this.kanjiView.kanji = nextKanji
		this.clearAnswers()
		this.generateAnswers()
		this.questionStartTime = Date.now()
	}

	onFinishTest() {
		this.parentElement.removeChild(this)
		State.app.mainMenu.activated = true
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
		let allKana = [...State.words.values()]
		let used = new Set<string>()

		// Add correct answer
		let correctAnswerIndex = Math.floor(Math.random() * this.answers.length)
		this.answers[correctAnswerIndex].innerText = this.correctAnswer
		used.add(this.correctAnswer)

		for(let answer of this.answers) {
			// Skip existing answers
			if(answer.innerText !== "") {
				continue
			}

			let text = randomItem(allKana).hiragana

			// Avoid duplicate answers
			if(allKana.length >= this.answers.length) {
				while(used.has(text)) {
					text = randomItem(allKana).hiragana
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

		let correctAnswer = this.correctAnswer

		if(answer.innerText === correctAnswer) {
			// If we clicked on the correctly highlighted answer,
			// simply go to the next question.
			if(answer.classList.contains("correct")) {
				this.nextQuestion()
				return
			}

			// Show answer in green
			answer.classList.add("correct")
		} else {
			answer.classList.add("wrong")

			for(let element of this.answers) {
				if(element.innerText === correctAnswer) {
					element.classList.add("correct")
					break
				}
			}
		}

		// Disable incorrect answer
		for(let element of this.answers) {
			if(element.innerText !== correctAnswer && !element.classList.contains("wrong")) {
				element.disabled = true
			}
		}
	}
}
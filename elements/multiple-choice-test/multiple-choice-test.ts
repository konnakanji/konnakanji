import AppView from "../app-view/app-view"
import KanjiView from "../kanji-view/kanji-view"
import TouchController from "scripts/TouchController"
import State from "scripts/State"
import randomItem from "scripts/randomItem"
import copyToClipboard from "scripts/copyToClipboard"
import cloneTemplate from "scripts/cloneTemplate"

export default class MultipleChoiceTest extends HTMLElement {
	appView: AppView
	kanjiView: KanjiView
	questionsInTest: string[]
	questionIndex: number
	question: HTMLDivElement
	answers: HTMLButtonElement[]
	touchController: TouchController

	constructor(questions: string[]) {
		super()
		this.questionsInTest = questions
	}

	async connectedCallback() {
		this.appView = document.getElementsByTagName("app-view")[0] as AppView

		this.initDOM()
		this.bindEventListeners()
		this.startTest()

		// Touch controller
		this.touchController = new TouchController()
		this.touchController.leftSwipe = () => this.onLeftSwipe()
	}

	disconnectedCallback() {
		this.touchController.unregister()
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
			alert(`Copied ${this.kanjiView.kanji}!`)
			return
		}

		if(!this.solved) {
			return
		}

		this.nextQuestion()
	}

	onLeftSwipe() {
		console.log("left")
		if(!this.solved) {
			return
		}

		this.nextQuestion()
	}

	nextQuestion() {
		this.questionIndex++

		if(this.questionIndex >= this.questionsInTest.length) {
			this.onFinishTest()
			return
		}

		let nextKanji = this.questionsInTest[this.questionIndex]
		this.kanjiView.kanji = nextKanji
		this.clearAnswers()
		this.generateAnswers()
	}

	onFinishTest() {
		this.parentElement.removeChild(this)
		this.appView.mainMenu.activated = true
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
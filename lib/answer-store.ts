export type StoredAnswer = {
  questionNo: number;
  questionText: string;
  answer: string;
  createdAt: string;
};

export class AnswerStore {
  private answers: StoredAnswer[] = [];

  saveAnswer(
    questionNo: number,
    questionText: string,
    answer: string
  ) {
    const existingIndex = this.answers.findIndex(
      (x) => x.questionNo === questionNo
    );

    const payload: StoredAnswer = {
      questionNo,
      questionText,
      answer: answer.trim(),
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.answers[existingIndex] = payload;
    } else {
      this.answers.push(payload);
    }
  }

  getAnswer(questionNo: number) {
    return this.answers.find(
      (x) => x.questionNo === questionNo
    );
  }

  getAllAnswers() {
    return [...this.answers].sort(
      (a, b) => a.questionNo - b.questionNo
    );
  }

  clear() {
    this.answers = [];
  }
}

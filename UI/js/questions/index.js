
const createQuestions = (response, selector = 'div#questions') => {
  const questionsNode = document.querySelector(selector);
  console.log(`Selector for the following: ${selector}`);
  response.questions.forEach((question) => {
    const {
      headline, votes, description, created, id,
    } = question;
    const temp_questions_template = questionTemplate()
      .replace('%headline%', headline.replaceAll('"', ''))
      .replace('%votes%', votes)
      .replace('%content%', description.replaceAll('"', ''))
      .replaceAll('%question-id%', id)
      .replace('%created%', formatDate(created));
    questionsNode.insertAdjacentHTML('afterbegin', temp_questions_template);
  });
};

const fetchQuestions = () => {
  getDataWithoutBody(`${API_URL}/questions/`, 'GET')
    .then(response => response.json())
    .then((response) => {
      createQuestions(response);
      document.querySelector('body').insertAdjacentHTML('afterbegin', createQuestionTemplate());
      setTimeout(() => {
        initPage();
      }, 500);
    })
    .catch(error => console.error(error));
};

const createAnswers = (e) => {
  document.querySelector('section#create-answer-section').innerHTML = createAnswerTemplate(e.target.dataset.questionid);
  document.querySelector('body').classList.add('show-create-answer');
  createEventListeners();
};


const showOrHideOtherQuestions = (e, reload) => {
  const bodyNode = document.querySelector('body');

  if (bodyNode.classList.contains('show-question') && !reload) {
    bodyNode.classList.remove('show-question');
    e.target.innerHTML = 'Show Answers';
    e.target.closest('.questions').classList.remove('show');
    return;
  }

  bodyNode.classList.add('show-question');
  e.target.closest('.questions').classList.add('show');
  e.target.innerHTML = 'Close';
  fetchAnswers(e, reload);
};


const fetchAnswers = (e, reload) => {
  verifyToken();
  const answersNode = e.target.closest('.questions').querySelector('.answers');
  getDataWithoutBody(`${API_URL}/questions/${e.target.dataset.questionid}`, 'GET')
    .then(response => response.json())
    .then((response) => {
      if (!answersNode.classList.contains('show') || reload) {
        response.answers.forEach((answer) => {
          const {
            headline, votes, description, created, id,
          } = answer.answer;

          const { user_username, user_name } = answer;

          const temp_answers_template = answersTemplate()
            .replace('%headline%', headline)
            .replace('%votes%', votes)
            .replaceAll('%answerid%', id)
            .replace('%content%', description)
            .replace('%created%', formatDate(created))
            .replace('%username%', user_username)
            .replace('%name%', user_name);

          answersNode.querySelector('hr').insertAdjacentHTML('afterend', temp_answers_template);

          answer.comments.forEach((commentObj) => {
            const {
              votes, comment, created, user_username, user_name,
            } = commentObj.comment;
            const temp_comment_template = commentTemplate()
              .replace('%votes%', votes)
              .replace('%content%', comment)
              .replace('%created%', formatDate(created))
              .replace('%username%', user_username)
              .replace('%name%', user_name);
            answersNode.querySelector(`#answer${id} .comments`).innerHTML = "<div class='flex-end left comment-header'>Comments</div><hr />";
            answersNode.querySelector(`#answer${id} .comments`).insertAdjacentHTML('beforeend', temp_comment_template);
          });
        });
      }
      setTimeout(() => {
        answersNode.classList.add('show');
      }, 500);
      createEventListeners();
    })
    .catch(error => console.error(error));
};

const submitCreateQuestionData = (event) => {
  verifyToken();
  const formData = getFormData(event);
  const formObject = getFormObject(event);
  if (formData.headline === '' || formData.description === '') {
    formObject.querySelector('.error').innerHTML = 'Kindly fill all fields';
    return;
  }
  const postEndPoint = formObject.attributes.action.nodeValue;
  postData(`${API_URL}${postEndPoint}`, formData, 'POST')
    .then(resp => resp.json())
    .then((resp) => {
      if (resp.success === true) {
        document.querySelector('body').classList.remove('show-create-question');
        document.querySelector('body').classList.remove('show-create-answer');
        // We're reloading the dashboard if we add a new question
        // This was the easiest idea I could think of without writing new stuff
        if (postEndPoint.indexOf('answers') === -1) {
          return loadDashboard();
        }
        const showNode = document.querySelector(`div.read-more[data-questionid="${event.target.dataset.questionid}"]`);
        showNode.target = showNode;
        showOrHideOtherQuestions(showNode, true);
        // location.reload(true);
      } else {
        formObject.querySelector('.error').innerHTML = resp.error;
      }
    });
};

$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");

  //for some reason, on page load, user-profile is still showing, even though the hidden class is on it
  //this hides it
  $('#user-profile').hide();

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  //this is what generates our first page load
  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    //check to see if they actually entered anything for 'username' and 'password'
    //if we don't check this, it will log in a blank user
    if (!username || !password) {
      return;
    }

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    if (!name || !username || !password) {
      return;
    }

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function () {
    hideElements();
    await generateStories();
    $allStoriesList.show();
    $('#favorited-articles').hide();
    $('#user-profile').hide();
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
      starredFavs();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    starredFavs();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }

    if (currentUser) {
      starredFavs();
    }
  }

  //function to save our starred favorites to our storyList every time the storyList refreshes
  //and show the correct solid stars
  function starredFavs() {
    const storyArr = Array.from($('li'));

    for (let story of storyArr) {
      for (let favorite of currentUser.favorites) {
        if (story.id === favorite.storyId) {
          story.firstElementChild.firstElementChild.className = 'fa-star fas';
        }
      }
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <span class="star">
          <i class="fa-star far"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);
    return storyMarkup;
  }

  //event listeners for star clicks
  //first, is for favoriting
  $('body').on('click', '.fa-star.far', async function (evt) {
    if (!currentUser) {
      return;
    } else {
      $(evt.target).removeClass('far').addClass('fas');
      const storyId = $(evt.target).closest('li').attr('id');
      //this method updates the currentUser.favorites array
      currentUser.favoriteStory(currentUser, storyId);
    }
  });

  //second is for unfavoriting
  $('body').on('click', '.fa-star.fas', async function (evt) {
    $(evt.target).removeClass('fas').addClass('far');
    const storyId = $(evt.target).closest('li').attr('id');
    //this method updates the currentUser.favorites array
    currentUser.unfavoriteStory(currentUser, storyId);
  });

  //event listener for clicking on the favorites link
  $('nav').on('click', '#nav-favorites', function () {
    $('#user-profile').hide();
    $('#favorited-articles').empty();

    //if there are no favorites, display text, else, show the favorited articles
    if (currentUser.favorites.length === 0) {
      hideElements();
      $('#favorited-articles').show();
      $('#favorited-articles').text('No favorites added!');
    } else {
      hideElements();
      $('#favorited-articles').show();

      //We get our favorites from our currentUser.favorites array
      //Notice, since we are looking at favorites, the stars are always going to be solid, so we can just
      //hard code the solid star from font-awesome in here
      for (let favorite of currentUser.favorites) {
        $('#favorited-articles').append(`
        <li id=${favorite.storyId}>
          <span class="star">
            <i class="fa-star fas"></i>
          </span>
          <a class="article-link" href=${favorite.url} target="a_blank">
            <strong>${favorite.title}</strong>
          </a>
          <small class="article-author">by ${favorite.author}</small>
          <small class="article-hostname ${getHostName(favorite.url)}">(${getHostName(favorite.url)})</small>
          <small class="article-username">posted by ${favorite.username}</small>
        </li>`);
      }
    }
  });

  //event listener for clicking on the my stories link
  $('nav').on('click', '#nav-my-stories', function () {
    $('#user-profile').hide();
    $ownStories.empty();

    if (currentUser.ownStories.length === 0) {
      hideElements();
      $('#favorited-articles').hide();
      $ownStories.show();
      $ownStories.text('No stories added by user yet!')
    } else {
      hideElements();
      $('#favorited-articles').hide();
      $ownStories.show();

      //getting our own submitted stories from currentUser.ownStories array
      for (let story of currentUser.ownStories) {
        $ownStories.append(`
        <li id=${story.storyId}>
          <span class="star">
            <i class="fa-star far"></i>
          </span>
          <a class="article-link" href=${story.url} target="a_blank">
            <strong>${story.title}</strong>
          </a>
          <small class="article-author">by ${story.author}</small>
          <small class="article-hostname ${getHostName(story.url)}">(${getHostName(story.url)})</small>
          <small class="article-username">posted by ${story.username}</small>
        </li>`);
      }

      //We add in the starredFavs function here so we can tell which stars need to be changed to solid
      //AFTER loading the articles
      starredFavs();

      //Adding the trash can icon from font-awesome
      $('#my-articles li').prepend(`
      <span class="trash-can">
        <i i class= "fa-trash-alt fas" ></i>
      </span >`);
    }
  });

  //event handler for clicking on a trash can
  $ownStories.on('click', '.fa-trash-alt', function (evt) {
    //we delete story from both the Hack or Snooze API AND our currentUser.favorites and
    //currentUser.ownStories arrays
    storyList.deleteStory(currentUser, evt.target.parentElement.parentElement.id);
    //We remove the article from the DOM
    $(evt.target.parentElement.parentElement).remove();
  });

  //event handler for clicking on our username link
  $('#nav-user-profile').on('click', function () {
    hideElements();
    $('#user-profile').empty();
    //shows our user profile info
    $('#user-profile').show();
    $('#user-profile').append(`
      <h4>User Profile Info</h4>
      <section>
        <div id="profile-name">Name: ${currentUser.name}</div>
        <div id="profile-username">Username: ${currentUser.username}</div>
        <div id="profile-account-date">Account Created: ${currentUser.createdAt}</div>
      </section>
    `);
  })

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  //function to display our submit, favorites, and my stories links when a user is logged in
  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navLogOut.css('display', 'inline');
    $('#nav-welcome').show();
    $('#nav-welcome').css('display', 'inline');
    $('#nav-user-profile').text(`${currentUser.username}`);
    $(`<section class="main-nav-links">
        <span>|</span >
        <a class="nav-link" href="#" id="nav-submit">submit</a>
        <span>|</span>
        <a class="nav-link" href="#" id="nav-favorites">favorites</a>
        <span>|</span>
        <a class="nav-link" href="#" id="nav-my-stories">my stories</a>
      </section >`).insertAfter('nav b');
  }

  //event handler for clicking on the submit link - shows the story submit form
  $('nav').on('click', '#nav-submit', function () {
    $submitForm.slideToggle();
  });

  //event handler for submitting a story
  $submitForm.on('submit', async function (evt) {
    evt.preventDefault();

    const newStory = {
      author: $('#author').val(),
      title: $('#title').val(),
      url: $('#url').val()
    }

    //addStory method adds the story info to our currentUser.ownStories array and returns the 
    //response from the API, a story object
    const storyObj = await storyList.addStory(currentUser, newStory);
    $allStoriesList.prepend(`
      <li id=${storyObj.storyId}>
        <span class="star">
          <i class="fa-star far"></i>
        </span>
        <a class="article-link" href=${storyObj.url} target="a_blank">
          <strong>${storyObj.title}</strong>
        </a>
        <small class="article-author">by ${storyObj.author}</small>
        <small class="article-hostname ${getHostName(storyObj.url)}">(${getHostName(storyObj.url)})</small>
        <small class="article-username">posted by ${storyObj.username}</small>
      </li>`);

    //resets the form
    $submitForm.trigger('reset');
  });

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */
  //with this function, we don't have to worry about syncing anything else to local storage, 
  //because our username will get us all of the saved info in currentUser - our favorites, our own stories,
  //and everything else associated with our user
  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});

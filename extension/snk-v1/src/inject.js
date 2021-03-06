/* global fetch, Request, Headers, chrome, localStorage */

const VALID_HOSTNAME = 'github.com'
const API = 'https://api.github.com/repos/'
const LI_TAG_ID = 'github-repo-size'
const GITHUB_TOKEN_KEY = 'x-github-token'

var excludeURIs = [
  "nodejs/node",
  "tensorflow/tensorflow",
  "django/django",
]

let githubToken

var snk_icon_dict = {
  'clone': '<i class="octicon octicon-search"></i>',
  'index': '<i class="octicon octicon-zap"></i>'
}

// callbacks
const clickCloneButton = () => {
  alert("Clone repository function is not implememted yet.")
}

const clickIndexButton = () => {
  alert("Index repository function is not implememted yet.")
}


// insert clone button
var cloneIcon = document.createElement('i');
cloneIcon.innerHTML = snk_icon_dict['clone']

const cloneButton = () => {
    var buttonHeader = document.querySelector('ul.pagehead-actions')
    var cloneButton = buttonHeader.querySelector('#snk-clone-button-container')
    if (!cloneButton) {
      cloneButton = document.createElement('li')
      cloneButton.id = 'snk-clone-button-container'
      buttonHeader.insertBefore(cloneButton, buttonHeader.lastChild)
    }
    cloneButton.innerHTML = "<a id='snk-clone-button' class='btn btn-sm minibutton snk-button tooltipped tooltipped-s' aria-label='Clone locally this repository.\nKeyboard shortcut: shift-C'>" + cloneIcon.innerHTML + " Clone </a>"
    document.getElementById('snk-clone-button').addEventListener("click", clickCloneButton)
}
cloneButton()

// insert index button
var indexIcon = document.createElement('i');
indexIcon.innerHTML = snk_icon_dict['index']

const indexButton = () => {
    var buttonHeader = document.querySelector('ul.pagehead-actions')
    var indexButton = buttonHeader.querySelector('#snk-index-button-container')
    if (!indexButton) {
      indexButton = document.createElement('li')
      indexButton.id = 'snk-index-button-container'
      buttonHeader.insertBefore(indexButton, buttonHeader.lastChild)
    }
    indexButton.innerHTML = "<a id='snk-index-button' class='btn btn-sm minibutton snk-button tooltipped tooltipped-s' aria-label='Index the repository tree in Sniperkit webservice.\nKeyboard shortcut: shift-I'>" + indexIcon.innerHTML + " Index </a>"
    document.getElementById('snk-index-button').addEventListener("click", clickIndexButton)
}
indexButton()

const isTree = (uri) => {
  const repoURI = uri.split('/')
  return repoURI.length === 2 || repoURI[2] === 'tree'
}

const getRepoInfoURI = (uri) => {
  const repoURI = uri.split('/')

  return repoURI[0] + '/' + repoURI[1]
}

const getRepoContentURI = (uri) => {
  const repoURI = uri.split('/')
  const treeBranch = repoURI.splice(2, 2, 'contents')

  if (treeBranch && treeBranch[1]) {
    repoURI.push('?ref=' + treeBranch[1])
  }

  return repoURI.join('/')
}

const getRepoTreeURI = (uri) => {
    const repoURI = uri.split('/')
    const treeBranch = repoURI.splice(2)

    repoURI.push('git/trees')
    if (treeBranch && treeBranch[1]) {
        repoURI.push(treeBranch[1])
    } else {
        repoURI.push('master')
    }

    return repoURI.join('/') + '?recursive=1'
}

const getHumanReadableSizeObject = (bytes) => {
  if (bytes === 0) {
    return {
      size: 0,
      measure: 'Bytes',
      style: ''
    }
  }

  const K = 1024
  const MEASURE = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(K))
  const size = parseFloat((bytes / Math.pow(K, i)).toFixed(2))

  var colorStyle = '#6a737d'

  if (i <= 1) {
    colorStyle = '#6a737d'
  } else if (i == 2) {

    if (size > 20) {
      colorStyle = 'red'
    } else {
      colorStyle = '#24292e'    
    }

  } else if (i > 2) {
    colorStyle = 'red'
  }

  return {
    size: size,
    measure: MEASURE[i],
    style: colorStyle,
  }
}

const getHumanReadableSize = (size) => {
  if (!size) return ''

  const t = getHumanReadableSizeObject(size)

  return '<span style="color:'+t.style+'!important;">' + t.size + ' ' + t.measure + '</span>'
}

const getSizeHTML = (size) => {
  const humanReadableSize = getHumanReadableSizeObject(size)

  return '<li id="' + LI_TAG_ID + '">' +
    '<a>' +
    '<svg class="octicon octicon-database" aria-hidden="true" height="16" version="1.1" viewBox="0 0 12 16" width="12">' +
    '<path d="M6 15c-3.31 0-6-.9-6-2v-2c0-.17.09-.34.21-.5.67.86 3 1.5 5.79 1.5s5.12-.64 5.79-1.5c.13.16.21.33.21.5v2c0 1.1-2.69 2-6 2zm0-4c-3.31 0-6-.9-6-2V7c0-.11.04-.21.09-.31.03-.06.07-.13.12-.19C.88 7.36 3.21 8 6 8s5.12-.64 5.79-1.5c.05.06.09.13.12.19.05.1.09.21.09.31v2c0 1.1-2.69 2-6 2zm0-4c-3.31 0-6-.9-6-2V3c0-1.1 2.69-2 6-2s6 .9 6 2v2c0 1.1-2.69 2-6 2zm0-5c-2.21 0-4 .45-4 1s1.79 1 4 1 4-.45 4-1-1.79-1-4-1z"></path>' +
    '</svg>' +
    '<span class="num text-emphasized"> ' +
    humanReadableSize.size +
    '</span> ' +
    humanReadableSize.measure +
    '</a>' +
    '</li>'
}

const checkStatus = (response) => {
  if (response.status >= 200 && response.status < 300) {
    return response
  }

  throw Error(`GitHub returned a bad status: ${response.status}`)
}

const parseJSON = (response) => {
  if (response) {
    return response.json()
  }

  throw Error('Could not parse JSON')
}

const getAPIData = (uri, callback) => {
  const headerObj = {
    'User-Agent': 'sniperkit/snk.chrome.github-repo-size'
  }

  const token = localStorage.getItem(GITHUB_TOKEN_KEY) || githubToken

  if (token) {
    headerObj['Authorization'] = 'token ' + token
  }

  const request = new Request(API + uri, {
    headers: new Headers(headerObj)
  })

  fetch(request)
    .then(checkStatus)
    .then(parseJSON)
    .then(callback)
    .catch(e => console.error(e))
}

const getFileName = (text) => text.trim().split('/')[0]

const checkForRepoPage = () => {
  const repoURI = window.location.pathname.substring(1)
  const repoPath = repoURI.split('/').splice(4).join('/').trim()

  /*
    console.log("window.location.href: " + window.location.href )
    console.log("window.location.hostname: " + window.location.hostname )
    console.log("window.location.protocol: " + window.location.protocol )
    console.log("window.location.pathname: " + window.location.pathname )
    console.log("window.location.pathname.substring(1): " + window.location.pathname.substring(1) )
    console.log("current uri: " + uri )
    console.log("exclude uri: " + excludeURIs.includes(uri) )
  */

  // skip workflow if not valid hostname
  if (window.location.hostname != VALID_HOSTNAME ) {
    console.log("invalid hostname: " + window.location.hostname )
    return
  }

  // const exclude = excludeURIs.includes(window.location.pathname.substring(1))
  if (excludeURIs.includes(window.location.pathname.substring(1))) {
    console.log("excluded repo uri: " + window.location.pathname.substring(1) )
  } else {

    if (isTree(repoURI)) {
      const ns = document.querySelector('ul.numbers-summary')
      const liElem = document.getElementById(LI_TAG_ID)
      const tdElems = document.querySelector('span.github-repo-size-td')

      if (ns && !liElem) {
        getAPIData(getRepoInfoURI(repoURI), (data) => {
          if (data && data.size) {
            ns.insertAdjacentHTML('beforeend', getSizeHTML(data.size * 1024))
          }
        })
      }

      if (!tdElems) {

        const apiGetRepoTreeURI = getRepoTreeURI(repoURI)
        // console.log("apiGetRepoTreeURI: " + apiGetRepoTreeURI)
        getAPIData(apiGetRepoTreeURI, (data) => {
          const sizeArray = {}

          for (const item of data.tree) {
            if (item.path.startsWith(repoPath)) {
              const commonPathPrefix = item.path.replace(new RegExp('^' + repoPath + '/?'), '').split('/')[0]
              sizeArray[commonPathPrefix] = (sizeArray[commonPathPrefix] || 0) + (item.size || 0)
            }
          }

          const list = document.querySelectorAll('table > tbody tr.js-navigation-item:not(.up-tree)')
          const files = document.querySelectorAll('table > tbody tr.js-navigation-item:not(.up-tree) td.content a')
          const ageForReference = document.querySelectorAll('table > tbody tr.js-navigation-item:not(.up-tree) td:last-child')

          let i = 0

          for (const file of files) {
            const t = sizeArray[getFileName(file.text)]

            const td = document.createElement('td')
            td.className = 'age'
            td.innerHTML = '<span class="css-truncate css-truncate-target github-repo-size-td">' + getHumanReadableSize(t) + '</span>'

            list[i].insertBefore(td, ageForReference[i++])
          }
        })
      }
    }
  }
}

chrome.storage.sync.get(GITHUB_TOKEN_KEY, (data) => {
  githubToken = data[GITHUB_TOKEN_KEY]

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes[GITHUB_TOKEN_KEY]) {
      githubToken = changes[GITHUB_TOKEN_KEY].newValue
    }
  })

  document.addEventListener('pjax:end', checkForRepoPage, false)

  checkForRepoPage()
})
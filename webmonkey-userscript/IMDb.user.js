// ==UserScript==
// @name         IMDb
// @description  Watch videos on external website.
// @version      1.0.0
// @match        *://imdb.com/title/tt*
// @match        *://*.imdb.com/title/tt*
// @icon         https://www.imdb.com/favicon.ico
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-IMDb/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-IMDb/issues
// @downloadURL  https://github.com/warren-bank/crx-IMDb/raw/webmonkey-userscript/es5/webmonkey-userscript/IMDb.user.js
// @updateURL    https://github.com/warren-bank/crx-IMDb/raw/webmonkey-userscript/es5/webmonkey-userscript/IMDb.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "use_fixed_positioning":  true
}

var constants = {
  "dom_ids": {
    "div_root_container":   "webmonkey_div_root_container",
    "div_series_container": "webmonkey_div_series_container",
    "select_hostname":      "webmonkey_select_hostname",
    "input_season_number":  "webmonkey_input_season_number",
    "input_episode_number": "webmonkey_input_episode_number",
    "button_open_website":  "webmonkey_button_open_website"
  }
}

var strings = {
  "labels": {
    "hostname":             "Select Video Host:",
    "season_number":        "Season #",
    "episode_number":       "Episode #",
    "open_website":         "Open Video Player"
  }
}

// ----------------------------------------------------------------------------- helpers

var make_element = function(elementName, html) {
  var el = unsafeWindow.document.createElement(elementName)

  if (html)
    el.innerHTML = html

  return el
}

var add_style_element = function(css) {
  if (!css) return

  var head = unsafeWindow.document.getElementsByTagName('head')[0]
  if (!head) return

  if ('function' === (typeof css))
    css = css()
  if (Array.isArray(css))
    css = css.join("\n")

  head.appendChild(
    make_element('style', css)
  )
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if ((url[0] === '/') && (typeof GM_resolveUrl === 'function'))
      url = GM_resolveUrl(url, unsafeWindow.location.href)
    if (url.indexOf('http') === 0)
      GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

// ----------------------------------------------------------------------------- prepopulate form fields

var prepopulate_form_fields = function() {
  var hash = unsafeWindow.location.hash
  if (!hash) return

  var hash_regex = /^#?S(\d+)E(\d+)$/i
  var matches    = hash_regex.exec(hash)
  if (!matches) return

  var season_number  = matches[1]
  var episode_number = matches[2]

  unsafeWindow.document.getElementById(constants.dom_ids.input_season_number).value  = season_number
  unsafeWindow.document.getElementById(constants.dom_ids.input_episode_number).value = episode_number
}

// ----------------------------------------------------------------------------- prepend form fields to DOM

var is_series = function() {
  var txt, el

  txt = unsafeWindow.location.pathname
  if (txt && (txt.toLowerCase().indexOf('/episodes') > 0))
    return true

  txt = unsafeWindow.document.title
  if (txt && (txt.toLowerCase().indexOf('tv series') >= 0))
    return true

  el = document.querySelector('script[type="application/ld+json"]')
  if (el) {
    txt = el.innerHTML
    if (txt && (txt.replace(/[\r\n\s]+/g, '').indexOf('"@type":"TVSeries"') >= 0))
      return true
  }

  return false
}

var open_website = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=true;

  var series, hostname, imdb_id, season_number, episode_number, url

  series   = is_series()
  hostname = unsafeWindow.document.getElementById(constants.dom_ids.select_hostname)
  imdb_id  = hostname.getAttribute('x-imdb-id')
  hostname = parseInt( hostname.value, 10 )

  if (series) {
    season_number  = parseInt( unsafeWindow.document.getElementById(constants.dom_ids.input_season_number).value,  10 )
    episode_number = parseInt( unsafeWindow.document.getElementById(constants.dom_ids.input_episode_number).value, 10 )
  }

  // validation
  if (!imdb_id) {
    unsafeWindow.alert('Error: IMDb ID not found')
    return
  }
  if (!hostname || isNaN(hostname) || (hostname <= 0)) {
    unsafeWindow.alert('Missing: video host')
    return
  }
  if (series && (!season_number || isNaN(season_number) || (season_number <= 0))) {
    unsafeWindow.alert('Missing: season number')
    return
  }
  if (series && (!episode_number || isNaN(episode_number) || (episode_number <= 0))) {
    unsafeWindow.alert('Missing: episode_number number')
    return
  }

  // construct website URL
  switch(hostname) {
    case 1:
      // VidSrc
      url = series
        ? ('https://vidsrc.me/embed/' + imdb_id + '/' + season_number + '-' + episode_number + '/')
        : ('https://vidsrc.me/embed/' + imdb_id + '/')
      break

    case 2:
      // Gdrive Player
      url = series
        ? ('http://database.gdriveplayer.us/player.php?imdb=' + imdb_id + '&type=series&season=' + season_number + '&episode=' + episode_number)
        : ('http://database.gdriveplayer.us/player.php?imdb=' + imdb_id)
      break
  }

  if (url)
    redirect_to_url(url)
}

var update_dom = function(imdb_id) {
  var html = [
    '<div>',
    '  <select id="' + constants.dom_ids.select_hostname + '" x-imdb-id="' + imdb_id + '">',
    '    <option value="0">' + strings.labels.hostname + '</option>',
    '    <option value="1">VidSrc</option>',
    '    <option value="2">Gdrive Player</option>',
    '  </select>',
    '</div>',
    '<div id="' + constants.dom_ids.div_series_container + '">',
    '  <span>' + strings.labels.season_number  + '</span><input id="' + constants.dom_ids.input_season_number  + '" type="number" min="1" max="99"  />',
    '  <span>' + strings.labels.episode_number + '</span><input id="' + constants.dom_ids.input_episode_number + '" type="number" min="1" max="999" />',
    '</div>',
    '<div>',
    '  <button id="' + constants.dom_ids.button_open_website + '">' + strings.labels.open_website + '</button>',
    '</div>'
  ]

  var div    = make_element('div', html.join("\n"))
  var series = is_series()

  div.setAttribute('id',  constants.dom_ids.div_root_container)
  div.querySelector('#' + constants.dom_ids.button_open_website).addEventListener('click', open_website)

  if (!series)
    div.querySelector('#' + constants.dom_ids.div_series_container).style.display = 'none'

  document.body.insertBefore(
    div,
    document.body.childNodes[0]
  )

  add_style_element(function(){
    var css

    css = [
      '#' + constants.dom_ids.div_root_container + ' {',
      '  border-top:    1px solid #333;',
      '  border-bottom: 1px solid #333;',
      '  padding: 10px 0;',
      '  margin:  20px 0;',
      '  background-color: #ffffff;',
      '  text-align: center;',
      '}',

      '#' + constants.dom_ids.div_root_container + ' > div {',
      '  padding: 5px 0;',
      '}',

      '#' + constants.dom_ids.div_root_container + ' > div#' + constants.dom_ids.div_series_container + ' > span + input {',
      '  margin-left: 5px;',
      '}'
    ]

    if (user_options.use_fixed_positioning) {
      css = css.concat([
        '#' + constants.dom_ids.div_root_container + ' {',
        '  margin: 0;',
        '  width: 100%;',
        '  position: fixed;',
        '  top: 0;',
        '  left: 0;',
        '  right: 0;',
        '  z-index: 9999;',
        '}',

        'nav#imdbHeader {',
        '  margin-top: 125px;',
        '}'
      ])
    }

    return css
  })

  prepopulate_form_fields()
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  var path       = unsafeWindow.location.pathname
  var path_regex = new RegExp('^/title/(tt\\d+)(?:/episodes)?/?$', 'i')

  if (!path_regex.test(path)) return

  var imdb_id = path.replace(path_regex, '$1').toLowerCase()
  update_dom(imdb_id)
}

init()

// -----------------------------------------------------------------------------
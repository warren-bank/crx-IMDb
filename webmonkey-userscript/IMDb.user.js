// ==UserScript==
// @name         IMDb
// @description  Watch videos on external website.
// @version      1.0.6
// @match        *://imdb.com/title/tt*
// @match        *://*.imdb.com/title/tt*
// @icon         https://www.imdb.com/favicon.ico
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
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
  "regexs": {
    "url_path": new RegExp('^/title/(tt\\d+)(?:/episodes)?/?$', 'i')
  },
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

// ----------------------------------------------------------------------------- state

var state = {
  "select_hostname_value":  null
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

// -----------------------------------------------------------------------------

var extract_season_episode_from_regex = function(text, regex) {
  if (!text  || ('string' !== (typeof text))) return null
  if (!regex || !(regex instanceof RegExp))   return null

  var matches = regex.exec(text)
  if (!matches) return null

  var season_number  = matches[1]
  var episode_number = matches[2]

  return {season_number: season_number, episode_number: episode_number}
}

// ----------------------------------------------------------------------------- persistent cache

var is_persistent_storage_available = function() {
  return ((typeof GM_setValue === 'function') && (typeof GM_getValue === 'function'))
}

var set_cache = function(imdb_id, season_number, episode_number) {
  if (!is_persistent_storage_available()) return

  var json = JSON.stringify({
    "s": season_number,
    "e": episode_number
  })

  GM_setValue(imdb_id, json)
}

var get_cache = function(imdb_id, auto_increment) {
  if (!is_persistent_storage_available()) return null

  var json = GM_getValue(imdb_id, '')
  if (!json) return null

  try {
    var data = JSON.parse(json)

    if (auto_increment)
      data.e++

    return {season_number: data.s, episode_number: data.e}
  }
  catch(e){
    return null
  }
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

// ----------------------------------------------------------------------------- inspect DOM: deep link for episode in series

var get_episode_deep_link = function() {
  var imdb_id, season_number, episode_number
  var el, path
  var ul, spans, child
  var text, regex

  var process_regex = function() {
    var result = extract_season_episode_from_regex(text, regex)
    if (result) {
      season_number  = result.season_number
      episode_number = result.episode_number
    }
    else {
      imdb_id = null
      el      = null
    }
  }

  // site appears to use A/B testing; DOM is not consistent across page reloads (without using cookies)

  if (!imdb_id) {
    el = unsafeWindow.document.querySelector('a[role="button"][aria-label="View all episodes"][href]')
    if (el) {
      path = el.getAttribute('href').replace(/^.+?(\/title\/)/, '$1').replace(/\?.*$/, '')
      if (constants.regexs.url_path.test(path))
        imdb_id = path.replace(constants.regexs.url_path, '$1').toLowerCase()
      else
        el = null
    }
    if (el) {
      ul = el.parentNode.querySelector(':scope > ul')
      if (ul) {
        text = ''
        spans = ul.querySelectorAll('span')
        for (var i=0; i < spans.length; i++) {
          text += spans[i].innerHTML
        }
        text  = text.toLowerCase().replace(/[^a-z0-9]+/g, '')
        regex = /^s(?:eason)?(\d+)e(?:pisode)?(\d+)$/
        process_regex()
      }
      else {
        imdb_id = null
        el      = null
      }
    }
  }

  if (!imdb_id) {
    el = unsafeWindow.document.querySelector('div.button_panel.navigation_panel > a.bp_item.np_all')
    if (el) {
      text = el.innerHTML.replace(/[\r\n\s]+/g, '').toLowerCase()
      if (text.indexOf('allepisodes') === -1)
        el = null
    }
    if (el) {
      path = el.getAttribute('href').replace(/^.+?(\/title\/)/, '$1').replace(/\?.*$/, '')
      if (constants.regexs.url_path.test(path))
        imdb_id = path.replace(constants.regexs.url_path, '$1').toLowerCase()
      else
        el = null
    }
    if (el) {
      el = el.parentNode.querySelector(':scope > div.bp_item.bp_text_only div.bp_heading')
      if (el) {
        text = ''
        for (var i=0; i < el.childNodes.length; i++) {
          child = el.childNodes[i]
          if (child.nodeType === 3) {
            // text node
            text += child.textContent
          }
        }
        text  = text.toLowerCase().replace(/[^a-z0-9]+/g, '')
        regex = /^s(?:eason)?(\d+)e(?:pisode)?(\d+)$/
        process_regex()
      }
      else {
        imdb_id = null
      }
    }
  }

  return (imdb_id)
    ? {imdb_id: imdb_id, season_number: season_number, episode_number: episode_number}
    : null
}

// ----------------------------------------------------------------------------- prepopulate form fields: common

var update_form_fields_from_season_episode = function(data) {
  if (!data) return false

  unsafeWindow.document.getElementById(constants.dom_ids.input_season_number).value  = data.season_number
  unsafeWindow.document.getElementById(constants.dom_ids.input_episode_number).value = data.episode_number
  return true
}

var update_form_fields_from_regex = function(text, regex) {
  return update_form_fields_from_season_episode(
    extract_season_episode_from_regex(text, regex)
  )
}

// ----------------------------------------------------------------------------- prepopulate form fields: from DOM or URL #hash or persistent cache

var prepopulate_form_fields = function(imdb_id, episode_deep_link_data) {
  var OK, text, regex

  if (episode_deep_link_data) {
    OK = update_form_fields_from_season_episode(episode_deep_link_data)
  }
  else {
    text  = unsafeWindow.location.hash
    regex = /^#?S(\d+)E(\d+)$/i

    OK = update_form_fields_from_regex(text, regex)
  }

  if (!OK) {
    OK = update_form_fields_from_season_episode(get_cache(imdb_id, /* auto_increment= */ true))
  }

  return OK
}

// ----------------------------------------------------------------------------- prepopulate form fields: from event listener

var onclick_episode_label = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;

  var text, regex

  text  = event.target.innerHTML.toLowerCase().replace(/[^a-z0-9]+/g, '')
  regex = /^s(\d+)ep(\d+)$/

  update_form_fields_from_regex(text, regex)
}

var add_event_listeners = function() {
  if (unsafeWindow.location.pathname.toLowerCase().indexOf('/episodes') === -1) return

  var episide_labels = unsafeWindow.document.querySelectorAll('div[itemtype="http://schema.org/TVSeason"] > div.eplist > div.list_item > div.image > a > div > img + div:last-child')
  if (!episide_labels.length) return

  for (var i=0; i < episide_labels.length; i++) {
    episide_labels[i].addEventListener('click', onclick_episode_label)
  }
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
    txt = el.innerHTML.replace(/[\r\n\s]+/g, '')
    if (txt && ((txt.indexOf('"@type":"TVSeries"') >= 0) || (txt.indexOf('"@type":"TVEpisode"') >= 0)))
      return true
  }

  return false
}

var open_website = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;

  var series, hostname, imdb_id, season_number, episode_number, url

  series   = is_series()
  hostname = unsafeWindow.document.getElementById(constants.dom_ids.select_hostname)
  imdb_id  = hostname.getAttribute('x-imdb-id')

  hostname = (state.select_hostname_value)
    ? state.select_hostname_value
    : hostname.options[hostname.selectedIndex].value
  hostname = parseInt( hostname, 10 )

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
      // Vidcloud
      url = series
        ? ('https://vidclouds.us/tv.php?imdb=' + imdb_id + '&season=' + season_number + '&episode=' + episode_number)
        : ('https://vidclouds.us/' + imdb_id + '.html')
      break

    case 2:
      // VidSrc
      url = series
        ? ('https://vidsrc.me/embed/' + imdb_id + '/' + season_number + '-' + episode_number + '/')
        : ('https://vidsrc.me/embed/' + imdb_id + '/')
      break

    case 3:
      // Gdrive Player
      url = series
        ? ('http://database.gdriveplayer.us/player.php?imdb=' + imdb_id + '&type=series&season=' + season_number + '&episode=' + episode_number)
        : ('http://database.gdriveplayer.us/player.php?imdb=' + imdb_id)
      break

    case 4:
      // 2embed.ru
      url = series
        ? ('https://www.2embed.ru/embed/imdb/tv?id='    + imdb_id + '&s=' + season_number + '&e=' + episode_number)
        : ('https://www.2embed.ru/embed/imdb/movie?id=' + imdb_id)
      break
  }

  if (series)
    set_cache(imdb_id, season_number, episode_number)

  if (url)
    redirect_to_url(url)
}

var update_dom = function(imdb_id) {
  var html = [
    '<div>',
    '  <select id="' + constants.dom_ids.select_hostname + '" x-imdb-id="' + imdb_id + '" onchange="state.select_hostname_value = this.value">',
    '    <option value="0">' + strings.labels.hostname + '</option>',
    '    <option value="1">Vidcloud</option>',
    '    <option value="2">VidSrc</option>',
    '    <option value="3">Gdrive Player</option>',
    '    <option value="4">2Embed</option>',
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

  if (series)
    add_event_listeners()
}

// ----------------------------------------------------------------------------- bootstrap

var clear_all_timeouts = function() {
  var maxId = unsafeWindow.setTimeout(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearTimeout(i)
  }
}

var clear_all_intervals = function() {
  var maxId = unsafeWindow.setInterval(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearInterval(i)
  }
}

var init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  var path, imdb_id, episode_deep_link_data

  path = unsafeWindow.location.pathname
  if (!constants.regexs.url_path.test(path)) return

  imdb_id                = path.replace(constants.regexs.url_path, '$1').toLowerCase()
  episode_deep_link_data = get_episode_deep_link()

  if (episode_deep_link_data)
    imdb_id              = episode_deep_link_data.imdb_id

  clear_all_timeouts()
  clear_all_intervals()

  update_dom(imdb_id)
  prepopulate_form_fields(imdb_id, episode_deep_link_data)
}

init()

// -----------------------------------------------------------------------------

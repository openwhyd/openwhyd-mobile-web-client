/* globals $ */

const OPENWHYD_ORIGIN = "https://openwhyd.org";
const STREAM_LIMIT = 999999;
const NB_TRACKS = 2000; // number of tracks displayed on page

// AJAX functions

window.$ =
  window.$ ||
  new (function FakeJquery() {
    function loadJS(src, cb) {
      var inc = document.createElement("script");
      if (cb)
        inc.onload = inc.onreadystatechange = function () {
          if (
            inc.readyState == "loaded" ||
            inc.readyState == "complete" ||
            inc.readyState == 4
          )
            cb();
        };
      inc.src = src;
      document.getElementsByTagName("head")[0].appendChild(inc);
    }

    var _getJSON_counter = 0;
    return {
      getJSON: (url, cb) => {
        var wFct = "_getJSON_cb_" + ++_getJSON_counter;
        var wUrl = url.replace("=?", "=" + wFct);
        window[wFct] = function (data) {
          cb(data);
          // TODO: remove script element from DOM
          delete window[wFct];
        };
        loadJS(wUrl);
      },
    };
  })();

// main logic of mobile/index.html

(function () {
  // TrackFinder configuration

  var LABELS = {
    myPlaylists: "My playlists",
    playlistTracks: "Tracks",
    myLastPosts: "My recent tracks",
    myPosts: "My tracks",
    theirPosts: "Other tracks",
  };

  function eidToUrl(eId) {
    return (eId || "")
      .replace("/yt/", "https://youtube.com/watch?v=")
      .replace("/sc/", "https://soundcloud.com/")
      .replace("/dm/", "https://dailymotion.com/video/")
      .replace("/dz/", "https://deezer.com/track/")
      .replace("/vi/", "https://vimeo.com/");
  }

  // general utils / tools

  function htmlEscape(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // rendering

  function renderResults(array, name, q) {
    return ["<h1>" + (LABELS[name] || name) + "</h1>", "<ul>"]
      .concat(
        array.map(function (item) {
          var name = htmlEscape(item.name);
          if (q) name = name.replace(new RegExp(q, "gi"), "<b>$&</b>"); // highlight matching part
          return (
            "<li class='" +
            (item.cssClass || "") +
            "' " + //  class='"+(item.playerLabel||"")+"'
            (item.img ? " data-img='" + htmlEscape(item.img) + "'" : "") +
            (item.eId ? " data-eid='" + htmlEscape(item.eId) + "'" : "") +
            (item.id ? " data-pid='" + htmlEscape(item.id) + "'" : "") +
            ">" +
            "<div class='btnAdd'>✚</div>" +
            "<a href='" +
            htmlEscape(item.url) +
            "' target='_blank'>" +
            "<div class='thumb' style='background-image:url(" +
            htmlEscape(item.img) +
            ")'></div>" +
            name +
            "</a>" +
            //+ ((item.pl || {}).name ? "<p>" + htmlEscape(item.pl.name) + "</p>" : "")
            "</li>"
          );
        })
      )
      .concat(["</ul>"])
      .join("\n");
  }

  const renderTrack = (t) => ({
    url: eidToUrl(t.eId),
    img: t.img,
    name: t.name,
  });

  const renderPlaylist = (userId) => (playlist, i) => ({
    cssClass: "playlist" + (i >= 3 ? " hidden" : ""),
    url: playlist.url,
    img: `${OPENWHYD_ORIGIN}/img/playlist/${userId}_${playlist.id}`,
    name: playlist.name,
  });

  function displayTracks(tracks, sectionId) {
    document.getElementById(sectionId).innerHTML = renderResults(
      tracks.map(renderTrack),
      sectionId
    );
  }

  function displayPlaylists(userId, playlists, sectionId) {
    const more = { cssClass: "showMore", name: "More..." };
    document.getElementById(sectionId).innerHTML = renderResults(
      playlists.map(renderPlaylist(userId)).concat(more),
      sectionId
    );
    document.getElementsByClassName("showMore")[0].onclick = function (e) {
      e.preventDefault();
      this.parentNode.removeChild(this);
      for (const el of [...document.getElementsByClassName("hidden")]){
        el.classList.remove('hidden');
      }
      return false;
    };
    const playlistNodes = document.getElementsByClassName("playlist");
    for (let i = 0; i < playlistNodes.length; ++i)
      playlistNodes[i].onclick = function (e) {
        e.preventDefault();
        loadPlaylist(e.target);
        return false;
      };
  }

  // data retrieval

  function loadStream(url, callback) {
    $.getJSON(
      `${url}?format=json&limit=${STREAM_LIMIT}&callback=?`,
      callback,
      "json"
    );
  }

  function loadUserPlaylists(userId, callback) {
    $.getJSON(
      `${OPENWHYD_ORIGIN}/u/${userId}/playlists?format=json&callback=?`,
      callback
    );
  }

  function loadPlaylist(playlist) {
    var url =
      OPENWHYD_ORIGIN + playlist.href.substr(playlist.href.indexOf("/u/"));

    document.getElementById("playlistName").innerText = playlist.innerText;
    document.getElementById("playlistTracks").innerHTML = "";
    var i = 0;
    loadStream(url, function (tracks) {
      tracks = tracks || [];
      displayTracks(tracks, "playlistTracks");
      document.getElementById(
        "toYouTube"
      ).href = `https://www.youtube.com/watch_videos?video_ids=${tracks
        .filter((track) => track.eId.startsWith("/yt/"))
        .map((track) => track.eId.replace("/yt/", ""))
        .join(",")}`;
    });
    switchToPage("pgPlaylist");
  }

  // main logic

  let myTracks = [];

  function loadMainPage() {
    const userId = new URLSearchParams(window.location.search).get("uId");
    if (!userId) return;
    loadUserPlaylists(userId, function (playlists) {
      console.log(`Found ${playlists.length} playlists.`)
      document.getElementById("pleaseLogin").style.display = "none";

      displayPlaylists(userId, playlists, "myPlaylists");

      loadStream(`${OPENWHYD_ORIGIN}/u/${userId}`, (tracks) => {
        console.log(`Found ${tracks?.length} tracks.`)
        if (tracks) displayTracks(tracks.slice(0, NB_TRACKS), "myLastPosts");
        myTracks = tracks.map((tr) => ({
          ...tr,
          _normalized: [tr.name, tr.text].join(" ").toLowerCase(), // pre-compute and store normalized post name & description (for faster search)
        }));
      });
    });
  }

  function switchToPage(id) {
    var pages = document.getElementsByClassName("page");
    for (let i = 0; i < pages.length; ++i) pages[i].style.display = "none";
    document.getElementById(id).style.display = "block";
  }

  // function onAddTrack(btn) {
  //   var elt = btn.target.parentElement;
  //   var track = elt.dataset;
  //   var postData = {
  //     action: "insert",
  //     ctx: "mob",
  //     eId: track.eid,
  //     img: track.img,
  //     name: elt.getElementsByTagName("a")[0].innerText,
  //     "src[id]": "http://openwhyd.org/mobile",
  //     "src[name]": "Openwhyd Mobile Track Finder",
  //   };
  //   console.log("posting...", postData);
  //   var params = Object.keys(postData).map(function (key) {
  //     return key + "=" + encodeURIComponent(postData[key]);
  //   });
  //   $.getJSON(
  //     `${OPENWHYD_ORIGIN}/api/post?${params.join("&")}`,
  //     function (post) {
  //       console.log("posted:", post);
  //       if (!post || post.error)
  //         alert(
  //           "Sorry, we were unable to add this track\n" +
  //             ((post || {}).error || "")
  //         );
  //       else alert("Succesfully added this track!");
  //     }
  //   );
  // }

  var defaultResults = document.getElementById("pgResults").innerHTML;

  const searchBox = document.getElementById("q");

  function search(query) {
    var results = [];
    query = query.trim().toLowerCase(); // normalize search query
    var terms = !query ? [] : query.split(" ");
    return terms.reduce(
      // exclude results which name do not contain this term
      (results, term) =>
        results.filter((res) => res._normalized.indexOf(term) !== -1),
      myTracks
    );
  }

  function displaySearchResults(query) {
    if (!query) {
      switchToPage("pgMain");
      return;
    }
    switchToPage("pgResults");
    const tracks = search(query);
    if (tracks.length === 0) {
      document.getElementById("pgResults").innerHTML = defaultResults;
    } else {
      displayTracks(tracks, "myPosts");
    }
  }

  searchBox.onkeyup = () => displaySearchResults(searchBox.value);

  document.getElementsByClassName("searchClear")[0].onclick = function () {
    searchBox.value = "";
    displaySearchResults();
  };

  document.getElementById("exitPlaylist").onclick = function () {
    switchToPage("pgMain");
  };

  loadMainPage();
})();

/* globals $ */

const OPENWHYD_ORIGIN = "https://openwhyd.org";
const DEFAULT_USER_URI = "adrien";

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

    function loadJSON(src, cb) {
      var r = new XMLHttpRequest();
      r.onload = function () {
        var res = undefined;
        try {
          res = JSON.parse(this.responseText);
        } catch (e) {
          console.error(e);
        }
        cb(res, this);
      };
      r.open("get", src, true);
      r.send();
    }

    var _getJSON_counter = 0;
    return {
      getJSON: function (url, cb) {
        if (url[0] == "/" || url.indexOf("=?") == -1)
          // local request
          loadJSON(url, cb);
        else {
          var wFct = "_getJSON_cb_" + ++_getJSON_counter;
          var wUrl = url.replace("=?", "=" + wFct);
          window[wFct] = function (data) {
            cb(data);
            // TODO: remove script element from DOM
            delete window[wFct];
          };
          loadJS(wUrl);
        }
      },
      getScript: loadJS,
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

  // data retrieval

  function loadStream(url, id, cb) {
    function renderLastPost(t) {
      return {
        url: eidToUrl(t.eId),
        img: t.img,
        name: t.name,
      };
    }
    $.getJSON(
      url + "?format=json&callback=?",
      function (r) {
        if (r)
          document.getElementById(id).innerHTML = renderResults(
            r.map(renderLastPost),
            id
          );
        cb && cb(r);
      },
      "json"
    );
  }

  function loadUserPlaylists(userURI, cb) {
    $.getJSON(
      `${OPENWHYD_ORIGIN}/${userURI}/playlists?format=json&callback=?`,
      function (pl) {
        const u = { pl };
        if (!u || !u.pl) return;
        var uid = u._id,
          i = 0,
          more = { cssClass: "showMore", name: "More..." };
        function renderPlaylist(t) {
          return {
            cssClass: "playlist" + (++i > 3 ? " hidden" : ""),
            url: t.url,
            img: "/img/playlist/" + uid + "_" + t.id,
            name: t.name,
          };
        }
        document.getElementById("myPlaylists").innerHTML = renderResults(
          u.pl.map(renderPlaylist).concat(more),
          "myPlaylists"
        );
        document.getElementsByClassName("showMore")[0].onclick = function (e) {
          e.preventDefault();
          this.parentNode.removeChild(this);
          fadeIn(document.getElementsByClassName("hidden"));
          return false;
        };
        cb && cb(u, document.getElementsByClassName("playlist"));
      }
    );
  }

  function loadPlaylist(playlist) {
    var url =
      OPENWHYD_ORIGIN + playlist.href.substr(playlist.href.indexOf("/u/"));
    document.getElementById("playlistName").innerText = playlist.innerText;
    document.getElementById("playlistTracks").innerHTML = "";
    var i = 0;
    loadStream(url, "playlistTracks", function (tracks) {
      tracks = tracks || [];
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

  function loadMainPage() {
    const userId = new URLSearchParams(window.location.search).get("uId")
    if (!userId) return;
    const userURI = `u/${userId}` // DEFAULT_USER_URI;
    loadUserPlaylists(userURI, function (user, playlists) {
      document.getElementById("pleaseLogin").style.display = "none";
      loadStream(`${OPENWHYD_ORIGIN}/${userURI}`, "myLastPosts");
      for (let i = 0; i < playlists.length; ++i)
        playlists[i].onclick = function (e) {
          e.preventDefault();
          loadPlaylist(e.target);
          return false;
        };
    });
  }

  function switchToPage(id) {
    var pages = document.getElementsByClassName("page");
    for (let i = 0; i < pages.length; ++i) pages[i].style.display = "none";
    document.getElementById(id).style.display = "block";
  }

  function onAddTrack(btn) {
    var elt = btn.target.parentElement;
    var track = elt.dataset;
    var postData = {
      action: "insert",
      ctx: "mob",
      eId: track.eid,
      img: track.img,
      name: elt.getElementsByTagName("a")[0].innerText,
      "src[id]": "http://openwhyd.org/mobile",
      "src[name]": "Openwhyd Mobile Track Finder",
    };
    console.log("posting...", postData);
    var params = Object.keys(postData).map(function (key) {
      return key + "=" + encodeURIComponent(postData[key]);
    });
    $.getJSON("/api/post?" + params.join("&"), function (post) {
      console.log("posted:", post);
      if (!post || post.error)
        alert(
          "Sorry, we were unable to add this track\n" +
            ((post || {}).error || "")
        );
      else alert("Succesfully added this track!");
    });
  }

  //var mainResults = document.getElementById("mainResults");
  var defaultResults = document.getElementById("pgResults").innerHTML;

  document.getElementById("exitPlaylist").onclick = function () {
    switchToPage("pgMain");
  };

  // fade-in effect for results
  function fadeIn(nodeSet, liCondition) {
    var fadeQueue = [];
    for (let i = 0; i < nodeSet.length; ++i) {
      var li = nodeSet[i];
      //if (log) console.log(li);
      if (li.nodeName == "LI" && (!liCondition || liCondition(li))) {
        fadeQueue.push(li);
        li.className = (li.className || "") + " hidden";
      }
    }
    if (fadeQueue.length)
      var interval = setInterval(function () {
        var elt = fadeQueue.shift();
        if (elt) elt.className = elt.className.replace("hidden", "fadeIn");
        else clearInterval(interval);
      }, 10);
  }

  document.getElementById("searchPane").addEventListener(
    "DOMNodeInserted",
    function (ev) {
      if (ev.target.nodeName == "UL")
        fadeIn(ev.target.children, function (li) {
          return li.className.indexOf("hidden") == -1;
        });
    },
    false
  );

  loadMainPage();
})();

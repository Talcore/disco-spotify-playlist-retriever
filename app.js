
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var mysql = require('mysql');

var CLIENT_ID = ''; // Your client id
var CLIENT_SECRET = ''; // Your secret
var REDIRECT_URI = ''; // Your redirect uri

var DB_HOST = 'FILLIN HOST';
var DB_USER = 'FILLIN USERNAME';
var DB_PW = 'FILLIN PASSWORD';
var DB_DBASE = 'FILLIN DBNAME';

var PLAYLIST_ID = 'FILLIN SPOTIFY PLAYLIST ID';

//create DB connection
var con = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PW,
  database: DB_DBASE
});
//test connection
con.connect(function(err){
  if(err) throw err;
  console.log('Connected to DB');
});

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

		getTracks(access_token);

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

function getTracks(accessToken){
	var total = 0;

	//Get total amount of songs
	var options = {
        url: 'https://api.spotify.com/v1/playlists/' + PLAYLIST_ID + '/tracks?fields=total',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        json: true
    };

	request.get(options, function(error, response, body) {
		console.log('Retrieving total amount of ' + body.total + ' Songs');
		total = body.total;

		for(var i = 0; i < total; i += 100){
			var options = {
				url: 'https://api.spotify.com/v1/playlists/' + PLAYLIST_ID + '/tracks?fields=items(track(id,name,artists,album(name,images)))&offset=' + i,
				headers: { 'Authorization': 'Bearer ' + accessToken },
				json: true
			};

			request.get(options, function(error, response, body) {
				var tracks = [];
				console.log('Retrieved ' + body.items.length + ' Songs');
				var len = body.items.length;
				for(var j = 0; j < len; j++){
					var item = body.items[j].track;
					//JS ARRAY METHOD
					try{
						tracks.push([item.name, item.artists[0].name, item.album.name, item.id, item.album.images[0].url]);
					}catch(e){
						console.log(item);
					}
				}
				var sql = 'INSERT INTO alltracks (name, interpret, album, spotify_id, cover_url) VALUES ?';
				con.query(sql, [tracks], function(err, result){
					if(err) throw err;
					console.log('Number of records inserted: ' + result.affectedRows);
				});
			});
		}
	});
}


app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);

var express = require('express')
var request = require('request')
var cors = require('cors')
var querystring = require('querystring')
var cookieParser = require('cookie-parser')
const axios = require('axios')
require('dotenv').config({ path: '/Users/eric/Documents/GitHub/Spotify-Liked-Songs-To-Playlist/tokens.env' })

var client_id = process.env.CLIENT_ID
var client_secret = process.env.CLIENT_SECRET
var redirect_uri = 'http://localhost:8888/callback'

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */

var generateRandomString = function (length) {
    var text = ''
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}

var stateKey = 'spotify_auth_state'

var app = express()

app.use(express.static(__dirname + '/public'))
    .use(cors())
    .use(cookieParser())

app.get('/login', function (req, res) {
    var state = generateRandomString(16)
    res.cookie(stateKey, state)

    // your application requests authorization
    var scope = 'user-library-read playlist-modify-public'
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }))
})

const createPlaylist = async (accessToken, userId) => {
    let playlists = []

    let res = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, {headers: {Authorization: `Bearer ${accessToken}`}})
    for (i in res.data.items) {playlists.push(res.data.items[i])}

    while (res.data.items.length == 50) {
        res = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, {headers: {Authorization: `Bearer ${accessToken}`}})
        for (i in res.data.items) {playlists.push(res.data.items[i])}
    }

    for (i in playlists) {
        if (playlists[i].name == "Liked Songs" && playlists[i].owner.id == userId) {
            console.log(`Playlist ID: ${playlists[i].id}`)
            return null
        }
    }

    res = await axios.post(`https://api.spotify.com/v1/users/${userId}/playlists`, {name: "Liked Songs"}, {headers: {Authorization: `Bearer ${accessToken}`}})

    console.log(`Playlist ID: ${res.data.id}`)
    return res.data.id
}

const fetchLikedSongs = async (accessToken) => {
    let tracks = []
    let likedSongs = []

    let res = await axios.get('https://api.spotify.com/v1/me/tracks?offset=0&limit=50', {headers: {Authorization: `Bearer ${accessToken}`}})
    for (let i in res.data.items) {tracks.push(res.data.items[i].track.uri)}

    while (res.data.items.length == 50) {
        res = await axios.get(`https://api.spotify.com/v1/me/tracks?offset=${tracks.length}&limit=50`, {headers: {Authorization: `Bearer ${accessToken}`}})
        for (let i in res.data.items) {tracks.push(res.data.items[i].track.uri)}
    }

    while (tracks.length - (likedSongs.length * 100) >= 100) {
        let trackList = []
        for (let i = 0; i < 100; i++) {trackList.push(tracks[(likedSongs.length * 100) + i])}
        likedSongs.push(trackList)
    }

    let trackList = []
    for (let i = 0; i < tracks.length - (likedSongs.length * 100); i++) {trackList.push(tracks[(likedSongs.length * 100) + i])}
    likedSongs.push(trackList)

    console.log(`Liked Songs: ${tracks.length}`)
    return likedSongs
}

const fillPlaylist = async (accessToken, likedSongs, playlistId) => {
    for (let i in likedSongs) {
        await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {uris: likedSongs[i]}, {headers: {Authorization: `Bearer ${accessToken}`}})
    }
}

const main = async (accessToken, userId) => {
    const [playlistId, likedSongs] = await Promise.all([
		createPlaylist(accessToken, userId),
		fetchLikedSongs(accessToken)
	])

    if (playlistId == null) {console.log('Playlist Already Exists'); return}
    if (likedSongs.length == 0) {console.log('No Liked Songs'); return}

    await fillPlaylist(accessToken, likedSongs, playlistId)
    console.log('Playlist Filled')
}

app.get('/callback', function (req, res) {
    var code = req.query.code || null
    var state = req.query.state || null
    var storedState = req.cookies ? req.cookies[stateKey] : null

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }))
    } else {
        res.clearCookie(stateKey)
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        }

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var accessToken = body.access_token,
                    refreshToken = body.refresh_token

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + accessToken },
                    json: true
                }

                
                // use the access token to access the Spotify Web API
                request.get(options, function (error, response, body) {
                    console.log(body)
                    main(accessToken, body.id)
                    //createPlaylist(accessToken, userId, likedSongs)
                })

                

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    }))
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }))
            }
        })
    }
})

app.get('/refreshToken', function (req, res) {
    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    }

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var accessToken = body.accessToken
            res.send({
                'access_token': accessToken
            })
        }
    })
})

console.log('Listening on 8888')
app.listen(8888)
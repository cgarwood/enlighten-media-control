-- SPOTIFY AD CHECKER
-- watch spotify and mute audio while ads are playing

local oldArtist
local oldTrack
local oldVolume
local wasAd = false
local spotifyTimer
local spotifyFader

local log = function(s)
	print('SPOTIFY.LUA :: ' .. s)
end

spotify_fade_to = function (targetVol, duration)
	-- cancel the spotify fader timer if it is running
	if fader and fader:running() then fader:stop() end
	
	-- fix target volume
	targetVol = math.min(targetVol, 100)
	targetVol = math.max(targetVol, 0)
	
	local duration = duration or 2
	local volDiff = targetVol - hs.spotify.getVolume()
	if volDiff == 0 then
		hs.spotify.setVolume(targetVol)
		log('Already at target volume. Nothing to do.')
		return
	end
	
	local volAbsDiff = math.abs(volDiff)
	local volIncrement = 2 * (volDiff / volAbsDiff)             -- 2 or -2
	local steps = volDiff / volIncrement
	local fade_interval = duration / steps

	-- log('volIncrement: ' .. volIncrement)
	-- log('fade_interval: ' .. fade_interval)
	-- log('steps: ' .. steps)
	
	-- spotify has an error on setting the volume
	-- setting the volume to 50 results
	-- in the volume actually going to 49
	volIncrement = volIncrement + 1
	
	-- this is asynchronous
	fader = hs.timer.doUntil(
		function()
			local done = false
			done = done or (volIncrement > 0 and hs.spotify.getVolume() >= targetVol)
			done = done or (volIncrement < 0 and hs.spotify.getVolume() <= targetVol)
			if done then
				hs.spotify.setVolume(targetVol);
				return true
			end
		end,
		function(t)
			local vol = hs.spotify.getVolume()
			-- log(vol)
			if vol == targetVol then
				t:stop()
			else
				hs.spotify.setVolume(vol + volIncrement)
			end
		end,
		fade_interval
	)	
end

local isAd = function()
	local script = [[
	tell application "Spotify"
		set u to spotify url of current track
		return u
		--set isAd to "spotify:ad" is in spotifyURL
		--return isAd
	end tell
	]]
	local success, result, raw = hs.osascript.applescript(script)
	if success then
		if result:find('spotify:ad') ~= nil then
			return true
		end
	end
end

local checkTrack = function()
	if not hs.spotify.isRunning() then
		spotifyTimer:setNextTrigger(10)
		return
	end
	if not hs.spotify.isPlaying() then
		spotifyTimer:setNextTrigger(10)
		return
	end
	log('CHECKING FOR AD')
	local artist = hs.spotify.getCurrentArtist()
	local track = hs.spotify.getCurrentTrack()
	if artist ~= oldArtist and track ~= oldTrack then
		if isAd() then
			if not wasAd then
				oldVolume = hs.spotify.getVolume()
				-- hs.spotify.setVolume(0)
				spotify_fade_to(0,1)
				log('Ad detected. Silencing.')
				notify('Spotify ads started')
			end
			wasAd = true
		else
			if wasAd then
				if oldVolume == 0 then oldVolume = 80 end
				hs.timer.doAfter(1, function () spotify_fade_to(oldVolume,2) end )
				log('Music resuming. Restoring volume.')
				notify('Spotify ads have ended')
			else
				-- spotify is playing music,
				-- make sure volume is not zero
				-- when hammerspoon reloads during an ad,
				-- volume can get stuck at zero.
				if hs.spotify.getVolume() == 0 then
					-- hs.spotify.setVolume(70)
					spotify_fade_to(70,2)
				end
			end
			wasAd = false
		end
		oldArtist = artist
		oldTrack = track
	end
	-- how much time is left in the current track?
	local delay = hs.spotify.getDuration() - hs.spotify.getPosition()
	if delay < 1 then delay = .5 end
	if spotifyTimer then
		log('Next check in ' .. round(delay,2) .. ' seconds.')
		spotifyTimer:setNextTrigger(delay)
	end
end

function getAppState()
	local script = [[
   tell application "Spotify"
       set _volume to sound volume
       set _state to player state
       set _position to player position
       set _repeating to repeating enabled
       set _shuffling to shuffling enabled
       return {_volume, _state, _position, _repeating, _shuffling}
   end tell
	]]
	local success, result, raw = hs.osascript.applescript(script)
	if success then
		return result
	end
end

function getCurrentTrack()
	local script = [[
   tell application "Spotify"
       set _artist to artist of current track
       set _album to album of current track
       set _discno to disc number of current track
       set _duration to duration of current track
       set _played to played count of current track
       set _trackno to track number of current track
       set _popularity to popularity of current track
       set _id to id of current track
       set _name to name of current track
       set _artwork to artwork url of current track
       set _albartist to album artist of current track
       set _url to spotify url of current track
       return {_artist, _album, _discno, _duration, _played, _trackno, _popularity, _id, _name, _artwork, _albartist, _url}
   end tell
	]]
	local success, result, raw = hs.osascript.applescript(script)
	if success then
		return result
	end
end

function setSpotifyVar(varname, varval)
	local cmd = 'set '..varname..' to '..varval
	return sendSpotifyCmd(cmd)
end

function sendSpotifyCmd(cmd)
	local script = 'tell application "Spotify"\n'.. cmd ..'\nend tell'
	local success, result, raw = hs.osascript.applescript(script)
	if success then
		return result
	end
end

	
function volup()
	local cvol = hs.spotify.getVolume()
	local inc = math.max(2,cvol * 0.2)
	local tvol = math.min(100, cvol + inc)
	hs.spotify.setVolume(tvol)
end

function voldown()
	local cvol = hs.spotify.getVolume()
	local inc = math.max(1,cvol * 0.1)
	local tvol = math.max(0, cvol - inc)
	hs.spotify.setVolume(tvol)
end

spotifyTimer = hs.timer.new(1, checkTrack, true)
spotifyTimer:start()

hs.hotkey.bind({"cmd","alt","ctrl"}, "pad4", function() hs.spotify.previous();   spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad5", function() hs.spotify.playpause();  spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad6", function() hs.spotify.next();       spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad8", function() hs.spotify.setVolume(80) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad2", function() hs.spotify.setVolume(0)  end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad9", volup)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad3", voldown)


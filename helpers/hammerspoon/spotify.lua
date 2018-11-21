-- SPOTIFY AD CHECKER
-- watch spotify and mute audio while ads are playing
local oldArtist
local oldTrack
local oldVolume
local wasAd = false
local spotifyTimer
local spotifyFader
local spotifyAutoPlaylistTimer
local spotifyAutoPlaylistMenuTimer

-- menu items
local spotifyAutoPlaylistMenuItem = hs.menubar.new()

local log
function log(s)
	print('SPOTIFY.LUA :: ' .. s)
end

function spotifyFadeTo(targetVol, duration, callback)
	-- cancel the spotify fader timer if it is running
	if fader and fader:running() then fader:stop() end
	
	-- fix target volume
	targetVol = math.min(targetVol, 100)
	targetVol = math.max(targetVol, 0)
	local nowVol = hs.spotify.getVolume()
	local duration = duration or 2
	local volDiff = targetVol - nowVol

	-- spotify has an error on setting the volume
	-- setting the volume to n results in a volume of n-1
	adjustedTargetVol = 0
	if targetVol > 0 then
		adjustedTargetVol = math.min(targetVol + 1, 100)
	end
	
	
	if volDiff == 0 then
		log('Already at target volume. Nothing to do.')
		return
	end
	
	-- do volume increments of 2
	-- spotify has some bugs when setting volume
	-- as a result, we always use an increment of 2
	-- and we use the adjustedTargetVol in some places
	local volIncrement = 2
	if volDiff < 0 then volIncrement = -2 end
	local steps = volDiff / volIncrement
	local fade_interval = duration / steps

	-- log('volIncrement: ' .. volIncrement)
	-- log('fade_interval: ' .. fade_interval)
	-- log('steps: ' .. steps)
	
	-- this is asynchronous
	fader = hs.timer.doUntil(
		function()
			local done = false
			local nowVol = hs.spotify.getVolume()
			done = done or (volIncrement > 0 and nowVol >= targetVol)
			done = done or (volIncrement < 0 and nowVol <= targetVol)
			if done then
				hs.spotify.setVolume(adjustedTargetVol);
				if callback then
					callback()
				end
				return true
			end
		end,
		function(t)
			local nowVol = hs.spotify.getVolume()
			if nowVol == targetVol then
				-- this should never be run
				log('ended by second function')
				t:stop()
			else
				-- remember that spotify erroneously
				-- subtracts 1 from the value sent to setVolume
				local newVol = nowVol + volIncrement + 1
				log('setting volume to: ' .. newVol)
				hs.spotify.setVolume(newVol)
			end
		end,
		fade_interval
	)	
end

function spotifyGetAppState()
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

function spotifyGetCurrentTrack()
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

function spotifySetVar(varname, varval)
	local cmd = 'set '..varname..' to '..varval
	return spotifySendCmd(cmd)
end

function spotifySendCmd(cmd)
	local script = 'tell application "Spotify"\n'.. cmd ..'\nend tell'
	local success, result, raw = hs.osascript.applescript(script)
	if success then
		return result
	end
end

function spotifyFadePlay(targetVol, duration, callback)
	hs.spotify.setVolume(0)
	hs.spotify.play()
	spotifyFadeTo(targetVol, duration, callback)
end

function spotifyFadePause(targetVol, duration, callback)
	spotifyFadeTo(targetVol, duration, function() hs.spotify.pause() if callback then callback() end end)
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

function spotifyAutoPlaylistPlay(target_duration, forced)
	-- kill auto timer if it exists
	if spotifyAutoPlaylistTimer then
		spotifyAutoPlaylistTimer:stop()
	end
	
	-- to avoid making a jarring start and stop
	-- wait until the song is over before setting up new list
	if not forced and hs.spotify.isPlaying() then
		-- when will this song end
		local song_duration = hs.spotify.getDuration()
		local song_position = hs.spotify.getPosition()
		local song_time_remaining = song_duration - song_position
		if song_time_remaining > 1 and song_duration < target_duration then
			print('Spotify Song has ' .. song_time_remaining .. ' seconds left. I will try again then.' )
			local try_again = song_time_remaining
			hs.timer.doAfter(try_again, function() spotifyAutoPlaylistPlay(target_duration - try_again, true, callback) end)
			return
		end
	end
	
	
	notify('Generating Spotify playlist for ' .. target_duration .. ' seconds.')
	hs.spotify.pause()

	-- this script works best if shuffling is off
	-- and repeating is on, so force those settings
	local script = [[
	tell application "Spotify"
		set shuffling to false
		set repeating to true
	end tell
	]]
	hs.osascript.applescript(script)
	
	local total = 0
	local songcount = 0
	local songtitles = {}
	local notify_string = 'Current Playlist'

	-- walk through playlist accumulating
	-- song durations until the total desired
	-- duration is reached
	while 1 do
		songcount = songcount + 1
		local duration = hs.spotify.getDuration()
		local title = hs.spotify.getCurrentTrack()
		table.insert(songtitles, title)
		print(title .. ' ' .. duration)
		total = total + duration
		print (total)
		if total >= target_duration then
			print ('reached the limit: breaking out')
			print ('Current Playlist:')
			for i,title in ipairs(songtitles) do
				print (title)
				notify_string = notify_string .. '\n' .. title
			end
			break
		end
		-- builtin spotify commands return before command is complete
		hs.spotify.next()
		hs.timer.usleep(250000) -- microsecond sleep to let spotify settle
	end
	
	-- go back to the song we started on
	-- by calling 'previous' repeatedly
	for i=songcount,2,-1 do hs.spotify.previous() end
	
	-- back this song up to a position where the remaining time
	-- plus the time of the following songs will exactly
	-- equal our target duration
	print ('Starting ' .. songtitles[1] .. ' at ' .. (total - target_duration))
	hs.spotify.setPosition(total - target_duration)
	
	-- start playing the generated playlist
	spotifyFadePlay(100,5)
	
	-- automatically fade out playlist is over
	spotifyAutoPlaylistTimer = hs.timer.doAfter(target_duration-5, function() spotifyFadePause(0, 5) end)
	spotifyAutoPlaylistMenuTimer = hs.timer.doEvery(0.1,spotifyAutoPlaylistMenuUpdate)
	hs.alert.show('Spotify Automatic Playlist:\n===============================\n' .. notify_string .. '\n\nAUTO FADE IN '..target_duration.. ' seconds.',5)
	
	return true
end

function spotifyAutoPlaylistMenuUpdate()
	local duration = math.floor(spotifyAutoPlaylistTimer:nextTrigger());
	if (duration > 0) then
		local secs = duration % 60
		local mins = math.floor(duration / 60)
		if secs < 10 then secs = '0' .. secs end
		spotifyAutoPlaylistMenuItem:setTitle('[AUTO-FADE: '..mins..':'..secs..']')
	else
		spotifyAutoPlaylistMenuItem:setTitle('')
		spotifyAutoPlaylistMenuTimer:stop()
	end
end


local isAd
function isAd()
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


local checkTrack
function checkTrack()
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
				spotifyFadeTo(0,1)
				log('Ad detected. Silencing.')
				notify('Spotify ads started')
			end
			wasAd = true
		else
			if wasAd then
				if oldVolume == 0 then oldVolume = 80 end
				hs.timer.doAfter(1, function () spotifyFadeTo(oldVolume,2) end )
				log('Music resuming. Restoring volume.')
				notify('Spotify ads have ended')
			else
				-- spotify is playing music,
				-- make sure volume is not zero
				-- when hammerspoon reloads during an ad,
				-- volume can get stuck at zero.
				if hs.spotify.getVolume() == 0 then
					-- hs.spotify.setVolume(70)
					spotifyFadeTo(70,2)
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
	if spotifyServer then
		spotifyServer:send(hs.json.encode(spotifyGetCurrentTrack()))
	end
end

spotifyTimer = hs.timer.new(1, checkTrack, true)
spotifyTimer:start()

hs.hotkey.bind({"cmd","alt","ctrl"}, "pad4", function() hs.spotify.previous();   spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad5", function() hs.spotify.playpause();  spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad6", function() hs.spotify.next();       spotifyTimer:setNextTrigger(1) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad8", function() hs.spotify.setVolume(80) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad2", function() hs.spotify.setVolume(0)  end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad7", function() spotifyFadePlay(80,5) end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad1", function() spotifyFadePause(0,5)  end)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad9", volup)
hs.hotkey.bind({"cmd","alt","ctrl"}, "pad3", voldown)



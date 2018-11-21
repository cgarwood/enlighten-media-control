-- SPOTIFY ITEMS
hs.hotkey.bind({"cmd", "alt", "ctrl"}, "0", function()
	hs.spotify.displayCurrentTrack()
end)

-- settings

-- times to trigger the auto fadeout
local spotify_auto_fadeout_times     = {
	hms2secs(8,59,0),
	hms2secs(10,44,0)
}

-- time before the fadeout to setup the playlist
local spotify_fadeout_playlist_time  = 1 * 60

-- time to actually do the fade
local spotify_fadeout_fade_time      = 5

-- timers
local fader
local spotify_fadeout_timer
local spotify_menu_countdown_timer
local spotify_timers = {}

-- menu items
local spotify_menu_countdown = hs.menubar.new()
local spotify_auto_menu      = hs.menubar.new()
local spotify_fadeout        = hs.menubar.new()
local spotify_fadein         = hs.menubar.new()


function pad(s,n,char)
	char = char or '0'
	n = n or 2
	local tmp = ''
	for i=1,n do
		tmp = tmp .. char
	end
	tmp = tmp .. s
	return string.sub(tmp,-n)
end

-- convert hours, minutes, and seconds to seconds
function hms2secs(hrs, mins, secs)
	return (hrs*60 + mins) * 60 + secs
end

-- convert seconds to time string
function secs2time(secs)
	local hrs = secs // 3600
	secs = secs % 3600
	local mins = secs // 60
	secs = secs % 60
	return pad(hrs) .. ':' .. pad(mins) .. ':' .. pad(secs)
end

-- seconds: plan to play spotify for this many seconds
function prepare_for_fadeout(seconds, forced)
	
	-- if a spotify auto fade_out timer is running, stop it
	-- so we don't get weirdness
	if spotify_fadeout_timer and spotify_fadeout_timer:running() then
		spotify_fadeout_timer:stop()
	end
	
	
	-- to avoid making a jarring start and stop
	-- wait until this song is over before setting up new list
	if not forced then
		-- when will this song end
		local song_duration = hs.spotify.getDuration()
		local song_position = hs.spotify.getPosition()
		local song_time_remaining = song_duration - song_position
		if song_time_remaining > 1 and song_duration < seconds then
			print('Spotify Song has ' .. song_time_remaining .. ' seconds left. I will try again then.' )
			local try_again = song_time_remaining
			hs.timer.doAfter(try_again, function() prepare_for_fadeout(seconds - try_again, true) end)
			return
		end
	end
	
	
	notify('Generating Spotify playlist for ' .. seconds .. ' seconds.')
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
	
	
	total = 0
	songcount = 0
	songtitles = {}
	notify_string = 'Current Playlist'

	-- walk through playlist to determine length of next songs
	while 1 do
		songcount = songcount + 1
		local duration = hs.spotify.getDuration()
		local title = hs.spotify.getCurrentTrack()
		table.insert(songtitles, title)
		print(title .. ' ' .. duration)
		total = total + duration
		print (total)
		if total >= seconds then
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
	for i=songcount,2,-1 do hs.spotify.previous() end
	target_duration = seconds
	
	-- back this song up
	print ('Starting ' .. songtitles[1] .. ' at ' .. (total - target_duration))
	hs.spotify.setPosition(total - target_duration)
	
	-- start playing the generated playlist
	spotify_fade_in(5)
	
	-- automatically fade out music when worship gathering is scheduled to start
	spotify_fadeout_timer = hs.timer.doAfter(seconds-5, function() spotify_fade_out(5, true) end)
	spotify_menu_countdown_timer = hs.timer.doEvery(0.1,spotify_menu_countdown_update)
	hs.alert.show('Spotify Automatic Playlist:\n===============================\n' .. notify_string .. '\n\nAUTO FADE IN '..seconds.. ' seconds.',5)
	
	-- hs.timer.doAfter(seconds, function() spotify_prepare() end)
	return total
end

function spotify_menu_countdown_update()
	local duration = math.floor(spotify_fadeout_timer:nextTrigger());
	if (duration > 0) then
		local secs = duration % 60
		local mins = math.floor(duration / 60)
		if secs < 10 then secs = '0' .. secs end
		spotify_menu_countdown:setTitle('[AUTO-FADE: '..mins..':'..secs..']')
	else
		spotify_menu_countdown:setTitle('')
		spotify_menu_countdown_timer:stop()
	end
end

function reset_to_time_left(n)
	-- resets the song to n seconds left
	local track_time = get_track_duration()
	local new_time = track_time - n
	
	-- send player position to spotify
	if (new_time > 0) then hs.spotify.setPosition(new_time) end
end

function spotify_fade_out(duration, advance)
	-- cancel the spotify fader timer if it is running
	if fader and fader:running() then fader:stop() end
	
	local duration = duration or 2
	local volinc = 2
	local steps = hs.spotify.getVolume() / volinc
	local time_interval = duration / steps
	
	-- this is asynchronous
	fader = hs.timer.doUntil(
		function()
			if hs.spotify.getVolume() == 0 then
				hs.spotify.pause()
				if advance then
					hs.spotify.next()
				end
				spotify_prepare()
				return true
			end
		end,
		function(t)
			local vol = hs.spotify.getVolume()
			if vol == 0 then
				t:stop()
			else
				hs.spotify.setVolume(vol - volinc)
			end
		end,
		time_interval
	)
end

function spotify_fade_in(duration, targetVolume)
	-- cancel the spotify fader timer if it is running
	if fader and fader:running() then fader:stop() end
	
	local duration = duration or 2
	local targetVolume = targetVolume or 90
	-- print (targetVolume)
	
	local volinc = 2
	local steps = targetVolume / volinc
	local time_interval = duration / steps
	
	hs.spotify.setVolume(0)
	hs.spotify.play()
	
	-- this is asynchronous
	fader = hs.timer.doUntil(
		function()
			if hs.spotify.getVolume() >= targetVolume then
				-- print 'returning true'
				return true
			end
		end,
		function(t)
			local vol = hs.spotify.getVolume()
			if vol >= targetVolume then
				t:stop()
			else
				-- a bug in the spotify implementation treats an increment of n as (n-1)
				-- print ('changing volume to ' .. (vol + volinc + 1))
				hs.spotify.setVolume(vol + volinc + 1)
			end
		end,
		time_interval
	)	
end

function spotify_prepare()
	-- this gets Spotify ready to play as soon as the button is clicked
	hs.spotify.pause()
	hs.spotify.setVolume(100)
	hs.spotify.setPosition(5)
end

-- spotify scheduled items
function spotify_timers_start()
	spotify_menu_countdown:setTitle('')

	for i,v in ipairs(spotify_timers) do
		v:stop()
	end
	
	for i,fadeout_time in ipairs(spotify_auto_fadeout_times) do
		print('Setting Spotify Timer to Fade Out At '..secs2time(fadeout_time))
		local playlist_duration = spotify_fadeout_playlist_time - spotify_fadeout_fade_time
		local spotify_playlist_prepare_at = fadeout_time - playlist_duration
		
		spotify_timers[i] = hs.timer.doAt(spotify_playlist_prepare_at, 24*60*60, function()
			if os.date("%A") == 'Sunday' then
				prepare_for_fadeout(playlist_duration, false)
			end
		end)
		spotify_timers[i]:start()
	end
end

function spotify_init()
	spotify_timers_start()

	-- spotify menu items
	spotify_auto_menu:setTitle('[AUTO PLAYLIST: ON]')
	spotify_auto_menu:setClickCallback(function ()
		if first_gathering_spotify_prepare:running() then
			first_gathering_spotify_prepare:stop()
			second_gathering_spotify_prepare:stop()
			spotify_auto_menu:setTitle('[AUTO PLAYLIST: OFF]')
		else
			first_gathering_spotify_prepare:start()
			second_gathering_spotify_prepare:start()
			spotify_auto_menu:setTitle('[AUTO PLAYLIST: ON]')
		end		
	end)


	spotify_fadeout:setClickCallback(function () spotify_fade_out(6) end)
	-- spotify_fadeout:setIcon("/Volumes/UserData/AV Team/Icons/Spotify_32.png", false)
	spotify_fadeout:setTitle('⤵︎  ')
	spotify_fadein:setClickCallback(function () spotify_fade_in(1, 100) end)
	spotify_fadein:setIcon("/Volumes/UserData/AV Team/Icons/Spotify_32.png", false)
	spotify_fadein:setTitle('⤴︎   ')
end

spotify_init()
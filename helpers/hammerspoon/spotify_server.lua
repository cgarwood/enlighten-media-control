-- this module starts a websocket server
-- to allow controlling spotify
-- from over the network

-- SETTINGS
local port = 9100
local authkey = '907ee5d004ecaa11a8164e4af51353f8'

-- FUNCTIONS
function socketHandler(message)
	local retval = {}
	print(message)
	data = hs.json.decode(message)
	retval.action = data.action

	-- data contains 'action', 'authkey', and 'arg'
	if data.authkey ~= authkey then
		retval.error = 'not authenticated'
	
	-- handle generic spotify actions
	elseif data.action == 'getCurrentTrack' then
		retval.data = spotifyGetCurrentTrack()
	elseif data.action == 'getAppState' then
		retval.data = spotifyGetAppState()
	elseif data.action == 'fadeTo' then
		retval.data = spotifyFadeTo(data.args[1], data.args[2])
	elseif data.action == 'setVar' then
		retval.data = spotifySetVar(data.args[1], data.args[2])
	elseif data.action == 'sendCmd' then
		retval.data = spotifySendCmd(data.args[1])
	
	-- handle custom actions like setting up automatic playlist
	end
	return hs.json.encode(retval)
end

local echo = function(s)
	print(s)
end

spotifyServer = hs.httpserver.new()
spotifyServer:setPort(port)
spotifyServer:websocket('/ws', socketHandler)
spotifyServer:setCallback(echo)
spotifyServer:start()

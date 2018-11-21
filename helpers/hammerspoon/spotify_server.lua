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
	elseif data.action == 'getCurrentTrack' then
		retval.data = getCurrentTrack()
	elseif data.action == 'getAppState' then
		retval.data = getAppState()
	elseif data.action == 'setVar' then
		retval.data = setSpotifyVar(data.args[1], data.args[2])
	elseif data.action == 'sendCmd' then
		retval.data = sendSpotifyCmd(data.args[1])
	end
	return hs.json.encode(retval)
end

local echo = function(s)
	print(s)
end

local server = hs.httpserver.new()



server:setPort(port)
server:websocket('/ws', socketHandler)
server:setCallback(echo)
server:start()

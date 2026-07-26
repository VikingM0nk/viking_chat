local chatInputActive = false
local chatInputActivating = false
local chatLoaded = false

-- Clear any leftover hide-state from the old /toggleChat command
DeleteResourceKvp('hideState')

RegisterNetEvent('chatMessage')
RegisterNetEvent('chat:addTemplate')
RegisterNetEvent('chat:addMessage')
RegisterNetEvent('chat:addSuggestion')
RegisterNetEvent('chat:addSuggestions')
RegisterNetEvent('chat:addMode')
RegisterNetEvent('chat:removeMode')
RegisterNetEvent('chat:removeSuggestion')
RegisterNetEvent('chat:clear')
RegisterNetEvent('__cfx_internal:serverPrint')
RegisterNetEvent('_chat:messageEntered')

local function pushConfig()
    SendNUIMessage({
        type = 'ON_CONFIG',
        messageDuration = Config.MessageDuration,
        maxVisible = Config.MaxVisible,
    })
end

-- deprecated event
AddEventHandler('chatMessage', function(author, color, text)
    local args = { text }
    if author ~= '' then
        table.insert(args, 1, author)
    end
    SendNUIMessage({
        type = 'ON_MESSAGE',
        message = {
            color = color,
            multiline = true,
            args = args,
        },
    })
end)

AddEventHandler('__cfx_internal:serverPrint', function(msg)
    print(msg)
    SendNUIMessage({
        type = 'ON_MESSAGE',
        message = {
            templateId = 'print',
            multiline = true,
            args = { msg },
            mode = '_global',
        },
    })
end)

local function addMessage(message)
    if type(message) == 'string' then
        message = { args = { message } }
    end
    SendNUIMessage({
        type = 'ON_MESSAGE',
        message = message,
    })
end

exports('addMessage', addMessage)
AddEventHandler('chat:addMessage', addMessage)

local function addSuggestion(name, help, params)
    SendNUIMessage({
        type = 'ON_SUGGESTION_ADD',
        suggestion = {
            name = name,
            help = help,
            params = params or nil,
        },
    })
end

exports('addSuggestion', addSuggestion)
AddEventHandler('chat:addSuggestion', addSuggestion)

AddEventHandler('chat:addSuggestions', function(list)
    SendNUIMessage({
        type = 'ON_SUGGESTION_ADD',
        suggestion = list,
    })
end)

AddEventHandler('chat:removeSuggestion', function(name)
    SendNUIMessage({
        type = 'ON_SUGGESTION_REMOVE',
        name = name,
    })
end)

AddEventHandler('chat:addMode', function(mode)
    SendNUIMessage({
        type = 'ON_MODE_ADD',
        mode = mode,
    })
end)

AddEventHandler('chat:removeMode', function(name)
    SendNUIMessage({
        type = 'ON_MODE_REMOVE',
        mode = type(name) == 'table' and name or { name = name },
    })
end)

AddEventHandler('chat:addTemplate', function(id, html)
    SendNUIMessage({
        type = 'ON_TEMPLATE_ADD',
        template = { id = id, html = html },
    })
end)

AddEventHandler('chat:clear', function()
    SendNUIMessage({ type = 'ON_CLEAR' })
end)

RegisterNUICallback('chatResult', function(data, cb)
    chatInputActive = false
    SetNuiFocus(false, false)

    if data and not data.canceled and data.message and data.message ~= '' then
        local msg = data.message
        if msg:sub(1, 1) == '/' then
            ExecuteCommand(msg:sub(2))
        else
            local id = PlayerId()
            TriggerServerEvent('_chat:messageEntered', GetPlayerName(id), { 201, 162, 39 }, msg, data.mode)
        end
    end

    cb('ok')
end)

local function refreshCommands()
    if not GetRegisteredCommands then return end

    local registeredCommands = GetRegisteredCommands()
    local suggestions = {}

    for _, command in ipairs(registeredCommands) do
        if IsAceAllowed(('command.%s'):format(command.name)) then
            suggestions[#suggestions + 1] = {
                name = '/' .. command.name,
                help = '',
            }
        end
    end

    TriggerEvent('chat:addSuggestions', suggestions)
end

AddEventHandler('onClientResourceStart', function()
    Wait(500)
    refreshCommands()
end)

AddEventHandler('onClientResourceStop', function()
    Wait(500)
    refreshCommands()
end)

RegisterNUICallback('loaded', function(_, cb)
    TriggerServerEvent('chat:init')
    refreshCommands()
    pushConfig()
    chatLoaded = true
    cb('ok')
end)

CreateThread(function()
    SetTextChatEnabled(false)
    SetNuiFocus(false, false)

    local lastForceHide = false
    local input = `INPUT_MP_TEXT_CHAT_ALL`

    while true do
        local waitMs = 200

        if not chatInputActive then
            waitMs = 0
            if IsControlPressed(0, input) then
                chatInputActive = true
                chatInputActivating = true
                SendNUIMessage({ type = 'ON_OPEN' })
            end
        end

        if chatInputActivating then
            waitMs = 0
            if not IsControlPressed(0, input) then
                SetNuiFocus(true, false)
                chatInputActivating = false
            end
        end

        if chatLoaded then
            local forceHide = IsScreenFadedOut() or IsPauseMenuActive()
            if forceHide ~= lastForceHide then
                lastForceHide = forceHide
                SendNUIMessage({
                    type = 'ON_FORCE_HIDE',
                    hidden = forceHide,
                })
            end
        end

        Wait(waitMs)
    end
end)

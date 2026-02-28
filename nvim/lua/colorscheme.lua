local colorscheme = 'darkplus'

local status_ok, _ = pcall(function()
    vim.cmd('colorscheme ' .. colorscheme)
end)
if not status_ok then
    vim.notify('colorscheme ' .. colorscheme .. ' not found!')
    return
end

vim.api.nvim_set_hl(0, 'FloatBorder', { fg = '#3E3E3E', bg = '#1E2530' })
vim.api.nvim_set_hl(0, 'NeoTreeFloatBorder', { fg = '#3E3E3E' })

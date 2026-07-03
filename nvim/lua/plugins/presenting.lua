return {
  'sotte/presenting.vim',
  cmd = { 'PresentingStart' },
  ft = { 'markdown', 'rst' },
  config = function()
    -- Optional: Add any custom configuration here
    -- Example: Set presenting options
    -- vim.g.presenting_slide_separator = '\v(^|\n)\ze#+ '
  end,
}
UPDATE vendors SET diff_command = 'configure session ztp-diff
{CONFIG}
show session-config diffs
abort' WHERE id = 'arista' AND (diff_command IS NULL OR diff_command = '');

UPDATE vendors SET diff_command = 'configure
{CONFIG}
show | compare
rollback 0
exit' WHERE id = 'juniper' AND (diff_command IS NULL OR diff_command = '');

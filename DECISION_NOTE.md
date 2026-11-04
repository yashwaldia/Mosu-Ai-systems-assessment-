# Decision note — no more than 400 words

Applicant: Yash Waldia (ywaldia@gmail.com)

Active time spent (including setup, shown separately): 70 minutes total — 5 minutes setup and 65 minutes for understanding, implementation, testing, and documentation. Within the 120-minute limit.

## One design decision

I kept the workflow in a single workflow.mjs file, with three main events: LOAD_PROFILE, APPROVE_ACTION, and SEND.

One important decision was to make approval specific to the exact action being performed, rather than just the customer's profile. I used a generated action ID based on the action type, profile ID, profile version, recipient, and message content.

This means that if the same action is loaded again, its existing approval and delivery information can be retained. However, if the recipient or message changes, it becomes a different action and requires fresh approval. This prevents an earlier approval from accidentally authorizing a changed message.

Within the time limit, I prioritized keeping the validation and workflow rules together rather than splitting them into additional modules. This made the changes easier to implement and verify within the available time.

## One failure you found and corrected

The most important issue I found was in Scenario 5: the system could report a message as sent even when the response from the messaging service was lost.

The original implementation also generated a different idempotency key for each retry. This created a risk of sending the same message more than once.

I changed the workflow so that:

Every retry uses the same action ID as its idempotency key.

A message is marked as sent only when the messaging service returns a receipt.

If the response is lost, the delivery status becomes unknown instead of incorrectly showing sent.

After two unsuccessful or uncertain attempts, the workflow moves to needs_reconciliation rather than retrying indefinitely.

Verification: Scenario 5 now records two attempts, one actual delivery, and the recovered receipt receipt-1.

## Remaining limitation or incomplete work

All six published checks pass.

## AI assistance and verification

I used Gemini to cross-check the contract against the workflow implementation and review validation edge cases.

I accepted its suggestion to validate measurement values and units independently, ensuring that multiple errors in one field are not missed. I rejected the suggestion to introduce additional custom state fields.

I personally checked the implementation using node smoke.mjs, node run.mjs, and additional tests for variant profiles and profiles with no validation issues.
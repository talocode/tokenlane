# 0.1.0

TokenLane now runs the workflow the README described. It still does not issue a token.

- `tokenlane plan` writes an onboarding receipt, a questionnaire, and a representation spec.
- `tokenlane hold`, `tokenlane transfer`, and `tokenlane registry` keep a local unit book under the supply cap.
- `tokenlane serve` exposes the same calls at `/v1/tokenlane/*`.
- `tokenlane mcp` exposes `tokenlane_plan`, `tokenlane_hold`, `tokenlane_transfer`, `tokenlane_registry`, and `tokenlane_receipt`.
- The SDK is `TokenLane`. Set `TALOCODE_TOKENLANE_URL` to use the server instead of the local files.
- The official $TCODE mint is recognized only so it is not treated as a new asset issuance.

Not mounted on api.talocode.site. Not published to npm from this commit.

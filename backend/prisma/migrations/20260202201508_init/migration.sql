-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "price_alert_threshold" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "investment_preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "market_cap" BIGINT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "stock_quotes" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "change_percent" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL,
    "avg_volume" BIGINT,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "previous_close" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ohlcv" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "ohlcv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quant_ratings" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "overall_rating" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "valuation_score" DOUBLE PRECISION NOT NULL,
    "growth_score" DOUBLE PRECISION NOT NULL,
    "profitability_score" DOUBLE PRECISION NOT NULL,
    "momentum_score" DOUBLE PRECISION NOT NULL,
    "revisions_score" DOUBLE PRECISION NOT NULL,
    "sector_rank" INTEGER,
    "industry_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quant_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundamental_metrics" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "pe" DOUBLE PRECISION,
    "forward_pe" DOUBLE PRECISION,
    "peg" DOUBLE PRECISION,
    "ps" DOUBLE PRECISION,
    "pb" DOUBLE PRECISION,
    "eps" DOUBLE PRECISION,
    "eps_growth" DOUBLE PRECISION,
    "revenue" BIGINT,
    "revenue_growth" DOUBLE PRECISION,
    "gross_margin" DOUBLE PRECISION,
    "operating_margin" DOUBLE PRECISION,
    "net_margin" DOUBLE PRECISION,
    "roe" DOUBLE PRECISION,
    "roa" DOUBLE PRECISION,
    "debt_to_equity" DOUBLE PRECISION,
    "current_ratio" DOUBLE PRECISION,
    "dividend_yield" DOUBLE PRECISION,
    "payout_ratio" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundamental_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_indicators" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rsi_14" DOUBLE PRECISION,
    "macd_value" DOUBLE PRECISION,
    "macd_signal" DOUBLE PRECISION,
    "macd_histogram" DOUBLE PRECISION,
    "sma_20" DOUBLE PRECISION,
    "sma_50" DOUBLE PRECISION,
    "sma_200" DOUBLE PRECISION,
    "ema_12" DOUBLE PRECISION,
    "ema_26" DOUBLE PRECISION,
    "bollinger_upper" DOUBLE PRECISION,
    "bollinger_middle" DOUBLE PRECISION,
    "bollinger_lower" DOUBLE PRECISION,
    "atr_14" DOUBLE PRECISION,
    "adx_14" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "source" TEXT NOT NULL,
    "source_credibility" TEXT NOT NULL DEFAULT 'medium',
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_item_stocks" (
    "news_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "news_item_stocks_pkey" PRIMARY KEY ("news_id","symbol")
);

-- CreateTable
CREATE TABLE "impact_analyses" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "magnitude" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "key_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "historical_comparison" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_filings" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "form_type" TEXT NOT NULL,
    "filed_at" TIMESTAMP(3) NOT NULL,
    "period_of_report" TIMESTAMP(3),
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sec_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'earnings',
    "date" TIMESTAMP(3) NOT NULL,
    "ai_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_participants" (
    "id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,

    CONSTRAINT "transcript_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_sections" (
    "id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "transcript_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earnings_events" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "fiscal_quarter" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "timing" TEXT NOT NULL DEFAULT 'unknown',
    "eps_estimate" DOUBLE PRECISION,
    "eps_actual" DOUBLE PRECISION,
    "eps_surprise" DOUBLE PRECISION,
    "revenue_estimate" BIGINT,
    "revenue_actual" BIGINT,
    "revenue_surprise" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earnings_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_events" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "ex_date" TIMESTAMP(3) NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'quarterly',
    "yield" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividend_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insider_trades" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "filed_at" TIMESTAMP(3) NOT NULL,
    "trade_date" TIMESTAMP(3) NOT NULL,
    "insider_name" TEXT NOT NULL,
    "insider_title" TEXT,
    "transaction_type" TEXT NOT NULL,
    "shares" BIGINT NOT NULL,
    "price_per_share" DOUBLE PRECISION NOT NULL,
    "total_value" DOUBLE PRECISION NOT NULL,
    "shares_owned" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insider_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screener_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screener_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "avg_cost_basis" DOUBLE PRECISION NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_transactions" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "price_per_share" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "sector" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL,
    "description" TEXT,
    "stock_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sector_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyst_ratings" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "analyst" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "target_price" DOUBLE PRECISION,
    "previous_rating" TEXT,
    "previous_target_price" DOUBLE PRECISION,
    "rating_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyst_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "watchlist_items_user_id_idx" ON "watchlist_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_user_id_symbol_key" ON "watchlist_items"("user_id", "symbol");

-- CreateIndex
CREATE INDEX "stocks_sector_idx" ON "stocks"("sector");

-- CreateIndex
CREATE INDEX "stocks_exchange_idx" ON "stocks"("exchange");

-- CreateIndex
CREATE INDEX "stock_quotes_symbol_timestamp_idx" ON "stock_quotes"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "ohlcv_symbol_timestamp_idx" ON "ohlcv"("symbol", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ohlcv_symbol_timestamp_key" ON "ohlcv"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "quant_ratings_symbol_idx" ON "quant_ratings"("symbol");

-- CreateIndex
CREATE INDEX "quant_ratings_overall_rating_idx" ON "quant_ratings"("overall_rating");

-- CreateIndex
CREATE UNIQUE INDEX "fundamental_metrics_symbol_key" ON "fundamental_metrics"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "technical_indicators_symbol_key" ON "technical_indicators"("symbol");

-- CreateIndex
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "impact_analyses_news_id_key" ON "impact_analyses"("news_id");

-- CreateIndex
CREATE INDEX "sec_filings_symbol_filed_at_idx" ON "sec_filings"("symbol", "filed_at");

-- CreateIndex
CREATE INDEX "transcripts_symbol_date_idx" ON "transcripts"("symbol", "date");

-- CreateIndex
CREATE INDEX "earnings_events_report_date_idx" ON "earnings_events"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "earnings_events_symbol_fiscal_year_fiscal_quarter_key" ON "earnings_events"("symbol", "fiscal_year", "fiscal_quarter");

-- CreateIndex
CREATE INDEX "dividend_events_symbol_ex_date_idx" ON "dividend_events"("symbol", "ex_date");

-- CreateIndex
CREATE INDEX "insider_trades_symbol_trade_date_idx" ON "insider_trades"("symbol", "trade_date");

-- CreateIndex
CREATE INDEX "screener_templates_user_id_idx" ON "screener_templates"("user_id");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_portfolio_id_symbol_key" ON "portfolio_holdings"("portfolio_id", "symbol");

-- CreateIndex
CREATE INDEX "portfolio_transactions_portfolio_id_transaction_date_idx" ON "portfolio_transactions"("portfolio_id", "transaction_date");

-- CreateIndex
CREATE INDEX "alerts_user_id_read_idx" ON "alerts"("user_id", "read");

-- CreateIndex
CREATE INDEX "alerts_user_id_created_at_idx" ON "alerts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "price_alerts_user_id_triggered_idx" ON "price_alerts"("user_id", "triggered");

-- CreateIndex
CREATE INDEX "price_alerts_symbol_idx" ON "price_alerts"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sector_subscriptions_user_id_sector_id_key" ON "sector_subscriptions"("user_id", "sector_id");

-- CreateIndex
CREATE INDEX "analyst_ratings_symbol_rating_date_idx" ON "analyst_ratings"("symbol", "rating_date");

-- CreateIndex
CREATE INDEX "offline_messages_user_id_created_at_idx" ON "offline_messages"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quotes" ADD CONSTRAINT "stock_quotes_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quant_ratings" ADD CONSTRAINT "quant_ratings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundamental_metrics" ADD CONSTRAINT "fundamental_metrics_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_indicators" ADD CONSTRAINT "technical_indicators_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_item_stocks" ADD CONSTRAINT "news_item_stocks_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_item_stocks" ADD CONSTRAINT "news_item_stocks_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_filings" ADD CONSTRAINT "sec_filings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_participants" ADD CONSTRAINT "transcript_participants_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_sections" ADD CONSTRAINT "transcript_sections_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings_events" ADD CONSTRAINT "earnings_events_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_events" ADD CONSTRAINT "dividend_events_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insider_trades" ADD CONSTRAINT "insider_trades_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screener_templates" ADD CONSTRAINT "screener_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_transactions" ADD CONSTRAINT "portfolio_transactions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_subscriptions" ADD CONSTRAINT "sector_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector_subscriptions" ADD CONSTRAINT "sector_subscriptions_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_ratings" ADD CONSTRAINT "analyst_ratings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stocks"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

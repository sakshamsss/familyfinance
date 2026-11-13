from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class CatalystPoint(BaseModel):
    title: str = Field(description="Short headline of the catalyst or risk")
    explanation: str = Field(description="Plain-English explanation citing the stock's actual numbers")


class BullBearDebateSchema(BaseModel):
    """Schema for Call 1: Adversarial Bull vs. Bear Analyst (thinking_level=MEDIUM)."""
    bull_case: List[CatalystPoint] = Field(
        description="3 concrete fundamental & technical reasons why the stock can reach Target 2 within 3-6 months."
    )
    bear_case: List[CatalystPoint] = Field(
        description="3 specific value-trap & downside risks explaining why the stock is below its 52W High."
    )


class FamilyJudgeSchema(BaseModel):
    """Schema for Call 2: Family Investment Judge Synthesis (thinking_level=HIGH)."""
    verdict: Literal["ACCUMULATE_IN_BUY_ZONE", "BUY_ON_DIP", "WAIT_FOR_EARNINGS", "AVOID_VALUE_TRAP"]
    ai_confidence_score: int = Field(ge=0, le=100, description="0 to 100 institutional conviction score")
    plain_english_summary: str = Field(
        description="Warm, crystal-clear 3-sentence summary for the family, free of Wall Street jargon, with full forms in brackets for any acronyms."
    )
    three_month_outlook: str = Field(
        description="Expected 90-day (3-month) operational & technical milestone toward Target 1 (Book 50%)."
    )
    six_month_outlook: str = Field(
        description="Expected 180-day (6-month) fundamental re-rating milestone toward Target 2 (Consensus Target)."
    )
    judge_rationale: str = Field(
        description="Clear synthesis of how the family should execute the trade ticket."
    )


class CatalystTimeline(BaseModel):
    checkpoint_90d: str
    checkpoint_180d: str


class FamilyAIReportSchema(BaseModel):
    ticker: str
    company_name: str
    generation_mode: Literal[
        "GEMINI_3_8_FLASH_PRIMARY",
        "GEMINI_3_5_FLASH_LITE_FALLBACK",
        "DETERMINISTIC_INSTITUTIONAL_SYNTHESIS",
    ]
    model_used: str = Field(default="gemini-3.8-flash")
    cached_24h: bool = Field(default=False)
    cache_key: Optional[str] = None
    verdict: Literal["ACCUMULATE_IN_BUY_ZONE", "BUY_ON_DIP", "WAIT_FOR_EARNINGS", "AVOID_VALUE_TRAP"]
    ai_confidence_score: int = Field(ge=0, le=100)
    conviction_score: int = Field(ge=0, le=100)
    plain_english_summary: str
    bull_case: List[CatalystPoint]
    bear_case: List[CatalystPoint]
    bull_catalysts: List[CatalystPoint]
    bear_risks: List[CatalystPoint]
    three_month_outlook: str
    six_month_outlook: str
    catalyst_timeline: CatalystTimeline
    judge_rationale: str

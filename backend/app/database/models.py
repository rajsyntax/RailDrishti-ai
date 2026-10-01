"""
RailDrishti AI – SQLAlchemy ORM models.

All tables use String PKs (station codes, section IDs) or UUID strings where
a surrogate key makes more sense. Deliberately kept lightweight so the app
can run with or without a live PostgreSQL instance.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, Index, Numeric
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def _now():
    return datetime.now(timezone.utc)

def _uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# 1. stations
# ---------------------------------------------------------------------------
class StationModel(Base):
    __tablename__ = "stations"

    station_code   = Column(String(10),  primary_key=True, index=True)
    station_name   = Column(String(100), nullable=False)
    latitude       = Column(Float,       nullable=False)
    longitude      = Column(Float,       nullable=False)
    zone           = Column(String(20),  nullable=True,  default="WR")
    division       = Column(String(30),  nullable=True,  default="Mumbai")
    platform_count = Column(Integer,     nullable=False, default=4)
    created_at     = Column(DateTime(timezone=True), default=_now)

    # relationships
    from_sections  = relationship("RailSectionModel", foreign_keys="RailSectionModel.from_station", back_populates="from_st")
    to_sections    = relationship("RailSectionModel", foreign_keys="RailSectionModel.to_station",   back_populates="to_st")
    schedules      = relationship("TrainScheduleModel", back_populates="station")


# ---------------------------------------------------------------------------
# 2. trains
# ---------------------------------------------------------------------------
class TrainModel(Base):
    __tablename__ = "trains"

    train_id           = Column(String(10),  primary_key=True, index=True)
    train_name         = Column(String(100), nullable=False)
    category           = Column(String(30),  nullable=False)   # Rajdhani / Express / Superfast / Mail
    priority           = Column(Integer,     nullable=False, default=2)
    source_station     = Column(String(10),  ForeignKey("stations.station_code"), nullable=False)
    destination_station= Column(String(10),  ForeignKey("stations.station_code"), nullable=False)
    total_distance_km  = Column(Float,       nullable=True)
    rake_type          = Column(String(20),  nullable=True,  default="LHB")
    is_active          = Column(Boolean,     nullable=False, default=True)
    created_at         = Column(DateTime(timezone=True), default=_now)

    schedules          = relationship("TrainScheduleModel", back_populates="train")
    live_states        = relationship("LiveTrainStateModel", back_populates="train")
    historical_runs    = relationship("HistoricalSectionRunModel", back_populates="train")
    eta_predictions    = relationship("EtaPredictionModel", back_populates="train")
    events             = relationship("OperationalEventModel", back_populates="train")


# ---------------------------------------------------------------------------
# 3. rail_sections
# ---------------------------------------------------------------------------
class RailSectionModel(Base):
    __tablename__ = "rail_sections"

    section_id               = Column(String(30),  primary_key=True, index=True)
    from_station             = Column(String(10),  ForeignKey("stations.station_code"), nullable=False)
    to_station               = Column(String(10),  ForeignKey("stations.station_code"), nullable=False)
    distance_km              = Column(Float,        nullable=False)
    normal_speed_kmph        = Column(Float,        nullable=False)
    capacity_score           = Column(Numeric(4,3), nullable=False)   # 0.00 – 1.00
    historical_median_minutes= Column(Float,        nullable=False)
    historical_p90_minutes   = Column(Float,        nullable=False)
    created_at               = Column(DateTime(timezone=True), default=_now)

    from_st        = relationship("StationModel", foreign_keys=[from_station], back_populates="from_sections")
    to_st          = relationship("StationModel", foreign_keys=[to_station],   back_populates="to_sections")
    historical_runs= relationship("HistoricalSectionRunModel", back_populates="section")
    events         = relationship("OperationalEventModel", back_populates="section")


# ---------------------------------------------------------------------------
# 4. train_schedule
# ---------------------------------------------------------------------------
class TrainScheduleModel(Base):
    __tablename__ = "train_schedule"

    id                   = Column(String(36), primary_key=True, default=_uuid)
    train_id             = Column(String(10), ForeignKey("trains.train_id"),      nullable=False, index=True)
    station_code         = Column(String(10), ForeignKey("stations.station_code"), nullable=False)
    sequence_number      = Column(Integer,    nullable=False)
    scheduled_arrival    = Column(String(8),  nullable=True)   # HH:MM:SS
    scheduled_departure  = Column(String(8),  nullable=True)
    day_offset           = Column(Integer,    nullable=False, default=0)  # 0 = day 1, 1 = day 2
    distance_from_source = Column(Float,      nullable=True)
    halt_minutes         = Column(Integer,    nullable=False, default=2)
    created_at           = Column(DateTime(timezone=True), default=_now)

    train   = relationship("TrainModel",   back_populates="schedules")
    station = relationship("StationModel", back_populates="schedules")

    __table_args__ = (
        Index("ix_schedule_train_seq", "train_id", "sequence_number"),
    )


# ---------------------------------------------------------------------------
# 5. live_train_state
# ---------------------------------------------------------------------------
class LiveTrainStateModel(Base):
    __tablename__ = "live_train_state"

    id                        = Column(String(36), primary_key=True, default=_uuid)
    train_id                  = Column(String(10), ForeignKey("trains.train_id"), nullable=False, index=True)
    recorded_at               = Column(DateTime(timezone=True), default=_now, index=True)
    latitude                  = Column(Float,   nullable=False)
    longitude                 = Column(Float,   nullable=False)
    speed_kmph                = Column(Float,   nullable=False, default=0.0)
    heading                   = Column(Float,   nullable=True)
    current_section           = Column(String(30), ForeignKey("rail_sections.section_id"), nullable=True)
    distance_to_next_station  = Column(Float,   nullable=True)
    delay_minutes             = Column(Integer, nullable=False, default=0)
    status                    = Column(String(20), nullable=False, default="RUNNING")

    train = relationship("TrainModel", back_populates="live_states")


# ---------------------------------------------------------------------------
# 6. operational_events
# ---------------------------------------------------------------------------
class OperationalEventModel(Base):
    __tablename__ = "operational_events"

    event_id         = Column(String(36),  primary_key=True, default=_uuid)
    event_type       = Column(String(30),  nullable=False)  # SIGNAL_FAULT / TRACK_BLOCK / SPEED_RESTRICTION / WEATHER
    severity         = Column(String(10),  nullable=False, default="MEDIUM")  # LOW / MEDIUM / HIGH / CRITICAL
    affected_train_id= Column(String(10),  ForeignKey("trains.train_id"),        nullable=True,  index=True)
    affected_section = Column(String(30),  ForeignKey("rail_sections.section_id"), nullable=True)
    started_at       = Column(DateTime(timezone=True), nullable=False, default=_now)
    expected_end_at  = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer,     nullable=True)
    speed_limit_kmph = Column(Float,       nullable=True)
    description      = Column(Text,        nullable=True)
    is_active        = Column(Boolean,     nullable=False, default=True)
    created_at       = Column(DateTime(timezone=True), default=_now)

    train   = relationship("TrainModel",       back_populates="events")
    section = relationship("RailSectionModel", back_populates="events")


# ---------------------------------------------------------------------------
# 7. eta_predictions
# ---------------------------------------------------------------------------
class EtaPredictionModel(Base):
    __tablename__ = "eta_predictions"

    id                  = Column(String(36),  primary_key=True, default=_uuid)
    train_id            = Column(String(10),  ForeignKey("trains.train_id"), nullable=False, index=True)
    target_station_code = Column(String(10),  ForeignKey("stations.station_code"), nullable=False)
    predicted_at        = Column(DateTime(timezone=True), default=_now, index=True)
    predicted_arrival   = Column(DateTime(timezone=True), nullable=False)
    scheduled_arrival   = Column(DateTime(timezone=True), nullable=True)
    delay_minutes       = Column(Integer,     nullable=False, default=0)
    confidence_score    = Column(Numeric(5,4), nullable=False, default=0.9)
    model_version       = Column(String(20),  nullable=True, default="v1.0-sim")
    feature_snapshot    = Column(Text,        nullable=True)  # JSON string

    train = relationship("TrainModel", back_populates="eta_predictions")


# ---------------------------------------------------------------------------
# 8. alerts
# ---------------------------------------------------------------------------
class AlertModel(Base):
    __tablename__ = "alerts"

    alert_id     = Column(String(36),  primary_key=True, default=_uuid)
    alert_type   = Column(String(30),  nullable=False)   # DELAY / PLATFORM_CHANGE / HALT / CANCELLATION
    train_id     = Column(String(10),  ForeignKey("trains.train_id"), nullable=True, index=True)
    station_code = Column(String(10),  ForeignKey("stations.station_code"), nullable=True)
    severity     = Column(String(10),  nullable=False, default="INFO")
    title        = Column(String(200), nullable=False)
    message      = Column(Text,        nullable=False)
    is_read      = Column(Boolean,     nullable=False, default=False)
    is_active    = Column(Boolean,     nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), default=_now, index=True)
    expires_at   = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# 9. historical_section_runs
# ---------------------------------------------------------------------------
class HistoricalSectionRunModel(Base):
    __tablename__ = "historical_section_runs"

    id                    = Column(String(36), primary_key=True, default=_uuid)
    train_id              = Column(String(10), ForeignKey("trains.train_id"),         nullable=False, index=True)
    section_id            = Column(String(30), ForeignKey("rail_sections.section_id"), nullable=False, index=True)
    run_date              = Column(String(10), nullable=False)   # YYYY-MM-DD
    scheduled_run_minutes = Column(Float,      nullable=False)
    actual_run_minutes    = Column(Float,      nullable=False)
    average_speed_kmph    = Column(Float,      nullable=False)
    departure_delay_min   = Column(Integer,    nullable=False, default=0)
    arrival_delay_min     = Column(Integer,    nullable=False, default=0)
    congestion_score      = Column(Numeric(4,3), nullable=True)
    weather_condition     = Column(String(20), nullable=True, default="CLEAR")  # CLEAR / FOG / RAIN / STORM
    restriction_active    = Column(Boolean,    nullable=False, default=False)
    day_of_week           = Column(Integer,    nullable=True)   # 0=Mon … 6=Sun
    hour_of_day           = Column(Integer,    nullable=True)   # 0–23 (departure hour)
    created_at            = Column(DateTime(timezone=True), default=_now)

    train   = relationship("TrainModel",       back_populates="historical_runs")
    section = relationship("RailSectionModel", back_populates="historical_runs")

    __table_args__ = (
        Index("ix_hist_train_section", "train_id", "section_id"),
        Index("ix_hist_run_date", "run_date"),
    )


# ---------------------------------------------------------------------------
# 10. weather_events
# ---------------------------------------------------------------------------
class WeatherEventModel(Base):
    __tablename__ = "weather_events"

    event_id     = Column(String(36),  primary_key=True, default=_uuid)
    station_code = Column(String(10),  ForeignKey("stations.station_code"), nullable=True)
    condition    = Column(String(20),  nullable=False)   # FOG / RAIN / STORM / CLEAR
    intensity    = Column(String(10),  nullable=True)    # LIGHT / MODERATE / HEAVY
    visibility_m = Column(Integer,     nullable=True)
    wind_kmph    = Column(Float,       nullable=True)
    temp_celsius = Column(Float,       nullable=True)
    started_at   = Column(DateTime(timezone=True), nullable=False, default=_now)
    ended_at     = Column(DateTime(timezone=True), nullable=True)
    is_active    = Column(Boolean,     nullable=False, default=True)
    description  = Column(Text,        nullable=True)
    created_at   = Column(DateTime(timezone=True), default=_now)

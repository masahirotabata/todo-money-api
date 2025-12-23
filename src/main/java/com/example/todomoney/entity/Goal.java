package com.example.todomoney.entity;

import java.time.OffsetDateTime;
import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "goals")
public class Goal {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id")
  private User user;

  @Column(nullable = false)
  private String title;

  // ✅ numeric と整合するように BigDecimal へ
  // 例: 円で扱うなら scale=0、小数を持つなら scale=2 などに変更してください
  @Column(name = "annual_income", nullable = false, precision = 14, scale = 0)
  private BigDecimal annualIncome = BigDecimal.ZERO;

  @Column(name = "days_per_year", nullable = false)
  private int daysPerYear = 365;

  @Column(nullable = false)
  private boolean achieved = false;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt = OffsetDateTime.now();

  public Long getId() { return id; }
  public User getUser() { return user; }
  public String getTitle() { return title; }
  public BigDecimal getAnnualIncome() { return annualIncome; }
  public int getDaysPerYear() { return daysPerYear; }
  public boolean isAchieved() { return achieved; }

  public void setUser(User user) { this.user = user; }
  public void setTitle(String title) { this.title = title; }

  // ✅ 受け口も BigDecimal に
  public void setAnnualIncome(BigDecimal annualIncome) {
    this.annualIncome = (annualIncome != null) ? annualIncome : BigDecimal.ZERO;
  }

  public void setDaysPerYear(int daysPerYear) { this.daysPerYear = daysPerYear; }
  public void setAchieved(boolean achieved) { this.achieved = achieved; }
}

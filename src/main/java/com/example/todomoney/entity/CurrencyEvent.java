package com.example.todomoney.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "currency_events")
public class CurrencyEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name="user_id")
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name="goal_id")
    private Goal goal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="task_id")
    private Task task;

    @Column(nullable = false)
    private String currency = "USD";

    // ★ Double → BigDecimal に変更（numeric 用）
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name="created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // ===== factory methods =====

    // BigDecimal 版（本体）
    public static CurrencyEvent usd(User user, Goal goal, Task task, BigDecimal amount) {
        CurrencyEvent e = new CurrencyEvent();
        e.user = user;
        e.goal = goal;
        e.task = task;
        e.currency = "USD";
        e.amount = amount;
        return e;
    }

    // 既存の double 呼び出しを壊さないためのオーバーロード
    public static CurrencyEvent usd(User user, Goal goal, Task task, double amount) {
        return usd(user, goal, task, BigDecimal.valueOf(amount));
    }

    // ===== getters =====

    public Long getId() {
        return id;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }
}

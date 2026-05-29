package com.example.todomoney.repo;

import com.example.todomoney.entity.InboxEntity;
import com.example.todomoney.entity.InboxEntity.InboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InboxRepository extends JpaRepository<InboxEntity, Long> {

    // ユーザーごとの未整理一覧
    List<InboxEntity> findByUserIdAndStatusOrderByCreatedAtDesc(
            Long userId,
            InboxStatus status
    );

    // ユーザーごとの全Inbox一覧
    List<InboxEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
}